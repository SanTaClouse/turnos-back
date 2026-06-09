import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Appointment } from '../../appointments/appointment.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { NotificationsService } from '../notifications.service';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** "YYYY-MM-DD" del día actual en la timezone del tenant. */
function todayInTz(timezone: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  // en-CA da formato YYYY-MM-DD, que es justo lo que guardamos en appointment.date
  return d.toLocaleDateString('en-CA', { timeZone: timezone });
}

/** "10:30:00" → "10:30" */
function trimSeconds(time: string): string {
  return (time || '').slice(0, 5);
}

/**
 * Etiqueta amigable de día para mostrar en la notif: "Hoy", "Mañana" o
 * "Vie 13 jun". Comparada en la timezone del tenant para que "Hoy" sea
 * correcto aunque el server esté en UTC.
 */
function dayLabel(dateStr: string, timezone: string): string {
  if (dateStr === todayInTz(timezone, 0)) return 'Hoy';
  if (dateStr === todayInTz(timezone, 1)) return 'Mañana';
  const [, m, d] = dateStr.split('-').map(Number);
  const date = new Date(dateStr + 'T00:00:00');
  return `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** Día en minúscula para el mensaje de WhatsApp: "hoy", "mañana", "el 13/06". */
function daySentence(dateStr: string, timezone: string): string {
  if (dateStr === todayInTz(timezone, 0)) return 'hoy';
  if (dateStr === todayInTz(timezone, 1)) return 'mañana';
  const [, m, d] = dateStr.split('-').map(Number);
  return `el ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Normaliza un teléfono a solo dígitos con código de país, para wa.me. */
function waPhone(phone: string, countryCode: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  const cc = (countryCode || '').replace(/\D/g, '');
  if (cc && !digits.startsWith(cc)) digits = cc + digits;
  return digits;
}

/**
 * Listener de eventos de appointments
 * Desacoplado de la lógica de negocio en AppointmentsService
 *
 * Beneficios:
 * - AppointmentsService solo emite eventos, no conoce de notificaciones
 * - Fácil agregar más listeners (email, WhatsApp, logs, etc.)
 * - Testeable independientemente
 * - Escala sin tocar AppointmentsService
 */
@Injectable()
export class AppointmentEventListener {
  constructor(private notificationsService: NotificationsService) {}

  /**
   * Cuando se crea un turno:
   * - Notificar al admin por push (para que vea el nuevo turno).
   * - NO mandar email al cliente: el email de confirmación se dispara
   *   recién cuando el admin confirma el turno (appointment.confirmed).
   *   Esto evita el "doble email" y le da al admin la decisión final.
   */
  @OnEvent('appointment.created')
  async onAppointmentCreated(data: {
    appointment: Appointment;
    tenant: Tenant;
  }) {
    const { appointment, tenant } = data;

    const tz = tenant.timezone || 'America/Argentina/Buenos_Aires';
    const clientName = appointment.client?.name || 'Cliente';
    const serviceName = appointment.service?.name || 'Turno';
    const time = trimSeconds(appointment.time);
    const when = `${dayLabel(appointment.date, tz)} ${time}`;

    // Mensaje de WhatsApp prellenado para que el admin se lo mande al cliente
    // con un toque desde la notificación de "turno confirmado".
    const phone = waPhone(appointment.client?.phone || '', tenant.country_code);
    const waText =
      `Hola ${clientName}! Tenés un turno para ` +
      `${daySentence(appointment.date, tz)} a las ${time}.` +
      (tenant.address ? ` Te espero en ${tenant.address}.` : '') +
      ` Saludos, ${tenant.name}.`;
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`
      : '';

    await this.notificationsService.notify({
      type: 'appointment.created',
      tenantId: appointment.tenant_id,
      appointmentId: appointment.id,
      clientId: appointment.client_id,
      title: `Nuevo turno: ${clientName}`,
      body: `${serviceName} · ${when}`,
      channels: ['push'],
      pushData: {
        clientName,
        when,
        waUrl,
      },
    });
  }

  /**
   * Recordatorio 24 horas antes
   * (Se ejecutaría mediante un job scheduler)
   */
  @OnEvent('appointment.reminder.24h')
  async onAppointmentReminder24h(data: {
    appointment: Appointment;
    tenant: Tenant;
  }) {
    const { appointment } = data;

    if (appointment.client?.email) {
      await this.notificationsService.notify({
        type: 'appointment.reminder.24h',
        tenantId: appointment.tenant_id,
        appointmentId: appointment.id,
        clientId: appointment.client_id,
        title: `Recordatorio: Tu turno es mañana`,
        body: `${appointment.service?.name} mañana a las ${appointment.time}`,
        channels: ['email'],
      });
    }
  }

  /**
   * Recordatorio 2 horas antes
   * (Se ejecutaría mediante un job scheduler)
   * Este es urgente, con push
   */
  @OnEvent('appointment.reminder.2h')
  async onAppointmentReminder2h(data: {
    appointment: Appointment;
    tenant: Tenant;
  }) {
    const { appointment } = data;

    if (appointment.client?.phone) {
      // WhatsApp es el más efectivo para recordatorios último minuto
      await this.notificationsService.notify({
        type: 'appointment.reminder.2h',
        tenantId: appointment.tenant_id,
        appointmentId: appointment.id,
        clientId: appointment.client_id,
        title: `⏰ Tu turno en 2 horas`,
        body: `${appointment.service?.name} en ${appointment.time}. Confirma que irás.`,
        channels: ['whatsapp', 'email'], // Multi-canal para garantizar entrega
      });
    }
  }

  /**
   * Cuando se cancela un turno
   * Notificar al cliente
   */
  @OnEvent('appointment.cancelled')
  async onAppointmentCancelled(data: {
    appointment: Appointment;
    tenant: Tenant;
  }) {
    const { appointment } = data;

    if (appointment.client?.email) {
      await this.notificationsService.notify({
        type: 'appointment.cancelled',
        tenantId: appointment.tenant_id,
        appointmentId: appointment.id,
        clientId: appointment.client_id,
        title: 'Tu turno fue cancelado',
        body: `${appointment.service?.name} del ${appointment.date} a las ${appointment.time}`,
        channels: ['email'],
      });
    }
  }

  /**
   * Cuando se confirma un turno pendiente
   */
  @OnEvent('appointment.confirmed')
  async onAppointmentConfirmed(data: {
    appointment: Appointment;
    tenant: Tenant;
  }) {
    const { appointment } = data;

    if (appointment.client?.email) {
      await this.notificationsService.notify({
        type: 'appointment.confirmed',
        tenantId: appointment.tenant_id,
        appointmentId: appointment.id,
        clientId: appointment.client_id,
        title: 'Tu turno está confirmado',
        body: `${appointment.service?.name} el ${appointment.date} a las ${appointment.time}`,
        channels: ['email'],
      });
    }
  }
}
