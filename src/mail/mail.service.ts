import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private from: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.from =
      this.configService.get<string>('EMAIL_FROM') ??
      'TurnosApp <turnos@turno1min.app>';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn(
        'RESEND_API_KEY no configurada. Los emails se loguearán a consola en lugar de enviarse.',
      );
    }
  }

  /**
   * Envía un código OTP de 6 dígitos por email.
   */
  async sendOtp(to: string, code: string): Promise<void> {
    const subject = `Tu código de verificación: ${code}`;
    const html = otpTemplate(code);
    const text = `Tu código de verificación TurnosApp es ${code}. Vence en 10 minutos.`;

    if (!this.resend) {
      this.logger.log(`[MOCK EMAIL] To: ${to} · Code: ${code}`);
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        text,
      });
      if (error) {
        this.logger.error(`Resend error: ${JSON.stringify(error)}`);
        throw new Error(error.message ?? 'Email failed');
      }
    } catch (err) {
      this.logger.error('Failed to send OTP email', err);
      throw err;
    }
  }

  /**
   * Envía la confirmación del turno por email con link de gestión.
   */
  async sendAppointmentConfirmation(opts: {
    to: string;
    clientName: string;
    businessName: string;
    serviceName: string;
    date: string;
    time: string;
    manageUrl: string;
  }): Promise<void> {
    const subject = `Tu turno en ${opts.businessName} está confirmado`;
    const html = appointmentTemplate(opts);
    const text = `Hola ${opts.clientName}, tu turno de ${opts.serviceName} en ${opts.businessName} es el ${opts.date} a las ${opts.time}. Gestionalo en ${opts.manageUrl}`;

    if (!this.resend) {
      this.logger.log(
        `[MOCK EMAIL] Confirmación a ${opts.to}: ${opts.serviceName} · ${opts.date} ${opts.time}`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to: opts.to,
        subject,
        html,
        text,
      });
    } catch (err) {
      this.logger.error('Failed to send appointment confirmation', err);
      // No lanzamos: la confirmación es best-effort, el turno ya quedó creado
    }
  }
}

function otpTemplate(code: string): string {
  return `
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; background: #fafaf7; padding: 40px 20px; margin: 0;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #ebeae3; border-radius: 14px; padding: 32px;">
      <div style="font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: 32px; color: #0f0f0e; letter-spacing: -1px; margin-bottom: 24px;">TurnosApp</div>
      <h1 style="font-family: 'Instrument Serif', Georgia, serif; font-size: 28px; color: #0f0f0e; letter-spacing: -0.5px; line-height: 1.1; margin: 0 0 12px;">Tu código de verificación</h1>
      <p style="color: #52514d; font-size: 14px; line-height: 1.5; margin: 0 0 28px;">Ingresá este código en la pantalla para acceder a tus turnos. Vence en 10 minutos.</p>
      <div style="background: #f3f2ec; border-radius: 10px; padding: 20px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 600; letter-spacing: 8px; color: #0f0f0e;">${code}</div>
      <p style="color: #8a8984; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">Si no solicitaste este código, podés ignorar este mensaje.</p>
    </div>
  </body>
</html>`;
}

function appointmentTemplate(opts: {
  clientName: string;
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  manageUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; background: #fafaf7; padding: 40px 20px; margin: 0;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #ebeae3; border-radius: 14px; padding: 32px;">
      <div style="font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: 32px; color: #0f0f0e; letter-spacing: -1px; margin-bottom: 24px;">TurnosApp</div>
      <h1 style="font-family: 'Instrument Serif', Georgia, serif; font-size: 28px; color: #0f0f0e; letter-spacing: -0.5px; line-height: 1.15; margin: 0 0 12px;">¡Hola ${opts.clientName}!<br>Tu turno está confirmado.</h1>
      <p style="color: #52514d; font-size: 14px; line-height: 1.5; margin: 0 0 24px;">Te esperamos en <strong>${opts.businessName}</strong>.</p>
      <div style="background: #f3f2ec; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8a8984; letter-spacing: 0.1em; text-transform: uppercase;">Servicio</div>
        <div style="color: #0f0f0e; font-size: 15px; font-weight: 500; margin-top: 4px;">${opts.serviceName}</div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8a8984; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 14px;">Cuándo</div>
        <div style="color: #0f0f0e; font-size: 15px; font-weight: 500; margin-top: 4px;">${opts.date} · ${opts.time}</div>
      </div>
      <a href="${opts.manageUrl}" style="display: inline-block; background: #0f0f0e; color: #fafaf7; text-decoration: none; padding: 14px 22px; border-radius: 14px; font-weight: 500; font-size: 14px;">Ver o cancelar mi turno</a>
      <p style="color: #8a8984; font-size: 12px; line-height: 1.5; margin: 28px 0 0;">Podés cancelar sin costo hasta 2 horas antes del turno.</p>
    </div>
  </body>
</html>`;
}
