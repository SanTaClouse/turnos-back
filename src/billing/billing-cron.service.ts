import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

/**
 * Cron de facturación. Corre una vez por día y hace dos cosas:
 *
 *  1) "Vencimiento": pasa a 'past_due' las suscripciones activas cuyo período
 *     ya venció (red de seguridad por si el webhook de Mercado Pago no llegó),
 *     arrancándoles el período de gracia.
 *
 *  2) Recordatorios: a todos los tenants que están en gracia (deben pagar pero
 *     todavía pueden usar la app) les manda una notificación push + email
 *     avisando que tienen que pagar, con el botón para hacerlo fácil.
 *
 * Cuando la gracia vence, el tenant queda bloqueado automáticamente (lo decide
 * BillingService.evaluateAccess); no hace falta tocar nada acá.
 */
@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async dailyBillingCheck(): Promise<void> {
    try {
      const lapsed = await this.billing.lapseExpiredSubscriptions();
      if (lapsed > 0) {
        this.logger.log(`${lapsed} suscripción(es) vencida(s) → past_due`);
      }

      const inGrace = await this.billing.getTenantsInGrace();
      this.logger.log(`Enviando recordatorios a ${inGrace.length} tenant(s)`);

      for (const tenant of inGrace) {
        const days = this.billing.daysUntilGraceEnd(tenant);
        await this.sendReminder(tenant.id, tenant.name, tenant.email, days);
      }
    } catch (err) {
      this.logger.error('Error en el cron de facturación', err);
    }
  }

  private async sendReminder(
    tenantId: string,
    tenantName: string,
    email: string | null,
    daysLeft: number,
  ): Promise<void> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const payUrl = `${appUrl}/admin/agenda`; // ahí aparece el banner con "Pagar"

    const title = '💳 Tu suscripción a Turno1min está pendiente';
    const body =
      daysLeft > 0
        ? `Te quedan ${daysLeft} día(s) para activar la suscripción. Después de eso el panel se bloquea hasta el pago.`
        : 'Tu período de gracia venció. Activá la suscripción para seguir usando Turno1min.';

    // 1) Push + feed in-app (a todos los dispositivos del dueño)
    try {
      await this.notifications.notify({
        type: 'billing.reminder',
        tenantId,
        title,
        body,
        channels: ['push'],
      });
    } catch (err) {
      this.logger.warn(`No se pudo enviar push de billing a ${tenantId}`);
    }

    // 2) Email al dueño con link directo para pagar
    if (email) {
      try {
        await this.mail.sendEmail({
          to: email,
          subject: title,
          text:
            `Hola ${tenantName},\n\n${body}\n\n` +
            `Activá tu suscripción acá: ${payUrl}\n\n` +
            `Son $20.000/mes con débito automático. Podés cancelar cuando quieras.\n\n` +
            `— Turno1min`,
        });
      } catch (err) {
        this.logger.warn(`No se pudo enviar email de billing a ${email}`);
      }
    }
  }
}
