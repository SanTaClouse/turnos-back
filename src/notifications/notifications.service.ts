import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscription } from './push-subscription.entity';
import { NotificationLog } from './notification-log.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Tenant } from '../tenants/tenant.entity';

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
          // Próximo: integrar con MailService
          console.log('EMAIL:', payload.title, payload.body);
          break;
        case 'whatsapp':
          // Próximo: integrar con WhatsappService
          console.log('WHATSAPP:', payload.title, payload.body);
          break;
        case 'sms':
          // Próximo: integrar con SMS service
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
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
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
