import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Appointment } from '../../appointments/appointment.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { NotificationsService, NotificationPayload } from '../notifications.service';

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
    const { appointment, tenant: _tenant } = data;

    await this.notificationsService.notify({
      type: 'appointment.created',
      tenantId: appointment.tenant_id,
      appointmentId: appointment.id,
      clientId: appointment.client_id,
      title: `Nuevo turno: ${appointment.client?.name || 'Cliente'}`,
      body: `${appointment.service?.name} - ${appointment.time}`,
      channels: ['push'],
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
