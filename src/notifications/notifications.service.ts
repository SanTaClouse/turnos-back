import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscription } from './push-subscription.entity';
import { NotificationLog } from './notification-log.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Client } from '../clients/client.entity';
import { MailService } from '../mail/mail.service';

export interface NotificationPayload {
  type: string; // 'appointment.created', 'appointment.reminder.24h', etc.
  tenantId: string;
  appointmentId?: string;
  clientId?: string;
  title: string;
  body: string;
  channels: ('push' | 'email' | 'whatsapp' | 'sms')[];
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(PushSubscription)
    private pushSubscriptionsRepo: Repository<PushSubscription>,
    @InjectRepository(NotificationLog)
    private notificationLogRepo: Repository<NotificationLog>,
    @InjectRepository(Appointment)
    private appointmentsRepo: Repository<Appointment>,
    @InjectRepository(Client)
    private clientsRepo: Repository<Client>,
    @InjectRepository(Tenant)
    private tenantsRepo: Repository<Tenant>,
    private mailService: MailService,
    private configService: ConfigService,
  ) {
    // Configurar web-push
    const vapidPublicKey = this.configService.get<string>(
      'VAPID_PUBLIC_KEY',
    );
    const vapidPrivateKey = this.configService.get<string>(
      'VAPID_PRIVATE_KEY',
    );

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(
        this.configService.get<string>('VAPID_SUBJECT') ||
          'mailto:admin@turno1min.app',
        vapidPublicKey,
        vapidPrivateKey,
      );
    }
  }

  /**
   * Método unificado: procesar notificación por múltiples canales
   * Desacoplado de la lógica de negocio
   */
  async notify(payload: NotificationPayload) {
    // Guardar en log para historial
    const log = this.notificationLogRepo.create({
      tenant_id: payload.tenantId,
      appointment_id: payload.appointmentId,
      client_id: payload.clientId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      channel: payload.channels.join(','), // Temporal para logging
      sent: false,
    });
    await this.notificationLogRepo.save(log);

    // Enviar por cada canal
    const results = await Promise.allSettled(
      payload.channels.map((channel) =>
        this.sendByChannel(channel, payload, log.id),
      ),
    );

    return results;
  }

  /**
   * Enviar por canal específico
   * Fácil de extender: solo agregar más cases
   */
  private async sendByChannel(
    channel: 'push' | 'email' | 'whatsapp' | 'sms',
    payload: NotificationPayload,
    logId: string,
  ) {
    try {
      switch (channel) {
        case 'push':
          return await this.sendPush(payload);
        case 'email':
          return await this.sendEmail(payload);
        case 'whatsapp':
          console.log('WHATSAPP:', payload.title, payload.body);
          break;
        case 'sms':
          console.log('SMS:', payload.title, payload.body);
          break;
      }

      // Marcar como enviado
      await this.notificationLogRepo.update(logId, {
        sent: true,
        sent_at: new Date(),
      });
    } catch (error) {
      // Registrar error en log
      await this.notificationLogRepo.update(logId, {
        sent: false,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Enviar notificación push
   * Aislado para fácil testing
   */
  private async sendPush(payload: NotificationPayload) {
    const subscriptions = await this.pushSubscriptionsRepo.find({
      where: { tenant_id: payload.tenantId },
    });

    if (!subscriptions.length) {
      return;
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.appointmentId || payload.type,
      data: {
        appointmentId: payload.appointmentId,
        tenantId: payload.tenantId,
        type: payload.type,
      },
    });

    const promises = subscriptions.map((sub) =>
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          pushPayload,
        )
        .catch((error) => {
          // Limpiar suscripciones expiradas
          if (error.statusCode === 410) {
            return this.pushSubscriptionsRepo.delete(sub.id);
          }
          console.error(`Error sending push:`, error);
        }),
    );

    return Promise.all(promises);
  }

  /**
   * Enviar notificación por email.
   *
   * Para `appointment.confirmed` usamos el template HTML lindo con link de
   * gestión (sendAppointmentConfirmation). Para el resto de tipos
   * (cancelled, reminders, etc) usamos el fallback de texto plano.
   */
  private async sendEmail(payload: NotificationPayload) {
    if (!payload.clientId) return;

    const client = await this.clientsRepo.findOne({
      where: { id: payload.clientId },
    });
    if (!client || !client.email) return;

    const tenant = await this.tenantsRepo.findOne({
      where: { id: payload.tenantId },
    });
    if (!tenant) return;

    if (payload.type === 'appointment.confirmed' && payload.appointmentId) {
      const appointment = await this.appointmentsRepo.findOne({
        where: { id: payload.appointmentId },
        relations: ['service'],
      });
      if (!appointment) return;

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ??
        'http://localhost:3001';
      const manageUrl = appointment.verification_token
        ? `${frontendUrl}/${tenant.slug}/mi-turno?appointmentId=${appointment.id}&token=${appointment.verification_token}`
        : `${frontendUrl}/${tenant.slug}/mi-turno`;

      await this.mailService.sendAppointmentConfirmation({
        to: client.email,
        clientName: client.name,
        businessName: tenant.name,
        serviceName: appointment.service?.name ?? 'Turno',
        date: appointment.date,
        time: appointment.time,
        manageUrl,
      });
      return;
    }

    // Fallback genérico (cancelled, reminders, etc.)
    const subject = this.buildEmailSubject(payload.type, tenant.name);
    await this.mailService.sendEmail({
      to: client.email,
      subject,
      text: payload.body,
    });
  }

  /**
   * Construir asunto del email según tipo de notificación
   */
  private buildEmailSubject(type: string, businessName?: string): string {
    const defaultName = businessName || 'TurnosApp';
    switch (type) {
      case 'appointment.created':
      case 'appointment.created.client':
        return `Tu turno en ${defaultName} está confirmado`;
      case 'appointment.confirmed':
        return `Tu turno está confirmado`;
      case 'appointment.cancelled':
        return `Tu turno fue cancelado`;
      case 'appointment.reminder.24h':
        return `Recordatorio: Tu turno es mañana`;
      case 'appointment.reminder.2h':
        return `⏰ Tu turno en 2 horas`;
      default:
        return `Notificación de ${defaultName}`;
    }
  }

  /**
   * Guardar suscripción de push
   */
  async subscribePush(
    tenantId: string,
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
  ) {
    const existing = await this.pushSubscriptionsRepo.findOne({
      where: { tenant_id: tenantId, endpoint: subscription.endpoint },
    });

    if (existing) {
      existing.keys = subscription.keys;
      return this.pushSubscriptionsRepo.save(existing);
    }

    const pushSub = this.pushSubscriptionsRepo.create({
      tenant_id: tenantId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    });

    return this.pushSubscriptionsRepo.save(pushSub);
  }
}
