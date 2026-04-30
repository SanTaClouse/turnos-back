import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { OtpCode } from './otp-code.entity';
import { Session } from './session.entity';
import { Tenant } from '../tenants/tenant.entity';
import { MailService } from '../mail/mail.service';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 3;

export interface AuthedSession {
  session: Session;
  tenant: Tenant;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    @InjectRepository(OtpCode)
    private otpRepo: Repository<OtpCode>,
    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    private mailService: MailService,
  ) {}

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDeviceLabel(userAgent: string | null | undefined): string {
    if (!userAgent) return 'Dispositivo desconocido';
    const ua = userAgent;
    let device = 'Browser';
    let browser = '';
    if (/iPad/.test(ua)) device = 'iPad';
    else if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/Android/.test(ua)) device = 'Android';
    else if (/Macintosh|Mac OS X/.test(ua)) device = 'Mac';
    else if (/Windows/.test(ua)) device = 'Windows';
    else if (/Linux/.test(ua)) device = 'Linux';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
    return browser ? `${device} · ${browser}` : device;
  }

  /**
   * Pide un código OTP por email. Por seguridad, devuelve éxito sin importar
   * si existe un tenant con ese email — así no exponemos qué emails están
   * registrados.
   */
  async requestCode(
    email: string,
  ): Promise<{ sent: true; expiresInMinutes: number }> {
    const normalized = email.trim().toLowerCase();
    if (!this.isValidEmail(normalized)) {
      throw new BadRequestException('Email inválido');
    }

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recent = await this.otpRepo.find({
      where: { email: normalized },
      order: { created_at: 'DESC' },
      take: RATE_LIMIT_MAX,
    });
    const recentInWindow = recent.filter((r) => r.created_at >= since);
    if (recentInWindow.length >= RATE_LIMIT_MAX) {
      throw new BadRequestException(
        'Demasiados intentos. Esperá un minuto antes de pedir otro código.',
      );
    }

    const tenant = await this.tenantRepo.findOne({
      where: { email: normalized },
    });

    const code = this.generateCode();
    const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        email: normalized,
        code,
        expires_at,
        attempts: 0,
      }),
    );

    if (tenant) {
      try {
        await this.mailService.sendOtp(normalized, code);
      } catch (err) {
        this.logger.error('Failed to send admin OTP email', err);
        throw new BadRequestException(
          'No pudimos enviar el código por mail. Probá de nuevo.',
        );
      }
    } else {
      this.logger.log(
        `[admin] OTP solicitado para email no registrado: ${normalized}`,
      );
    }

    return { sent: true, expiresInMinutes: OTP_TTL_MINUTES };
  }

  /**
   * Verifica el código y crea una session persistente.
   */
  async verifyCode(
    email: string,
    code: string,
    userAgent: string | null,
    ip: string | null,
  ): Promise<{
    session_token: string;
    tenant: { id: string; name: string; slug: string };
  }> {
    const normalized = email.trim().toLowerCase();
    if (!this.isValidEmail(normalized)) {
      throw new BadRequestException('Email inválido');
    }
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('El código debe tener 6 dígitos');
    }

    const otp = await this.otpRepo.findOne({
      where: { email: normalized, code, consumed_at: IsNull() },
      order: { created_at: 'DESC' },
    });
    if (!otp) {
      throw new UnauthorizedException('Código incorrecto o ya usado');
    }
    if (otp.expires_at < new Date()) {
      throw new UnauthorizedException('El código expiró. Pedí uno nuevo.');
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        'Demasiados intentos. Pedí un código nuevo.',
      );
    }

    const tenant = await this.tenantRepo.findOne({
      where: { email: normalized },
    });
    if (!tenant) {
      otp.consumed_at = new Date();
      await this.otpRepo.save(otp);
      throw new UnauthorizedException('No encontramos un negocio con ese email.');
    }

    otp.consumed_at = new Date();
    await this.otpRepo.save(otp);

    return this.createSession(tenant, userAgent, ip);
  }

  /**
   * Crea una session sin pasar por OTP. Usado al final del onboarding cuando
   * el dueño ya está creando su negocio en este device — confiamos en él.
   */
  async createSession(
    tenant: Tenant,
    userAgent: string | null,
    ip: string | null,
  ): Promise<{
    session_token: string;
    tenant: { id: string; name: string; slug: string };
  }> {
    const token = this.generateToken();
    const session = this.sessionRepo.create({
      token_hash: this.hashToken(token),
      tenant_id: tenant.id,
      device_label: this.parseDeviceLabel(userAgent),
      user_agent: userAgent,
      ip,
      last_used_at: new Date(),
    });
    await this.sessionRepo.save(session);
    return {
      session_token: token,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    };
  }

  /**
   * Valida un session_token. Usado por el AdminAuthGuard en cada request
   * protegido. Actualiza last_used_at de manera best-effort.
   */
  async validateSession(token: string): Promise<AuthedSession> {
    if (!token) throw new UnauthorizedException();
    const session = await this.sessionRepo.findOne({
      where: { token_hash: this.hashToken(token), revoked_at: IsNull() },
      relations: ['tenant'],
    });
    if (!session || !session.tenant) {
      throw new UnauthorizedException();
    }

    session.last_used_at = new Date();
    void this.sessionRepo.save(session).catch(() => undefined);

    return { session, tenant: session.tenant };
  }

  async listSessions(tenantId: string) {
    const sessions = await this.sessionRepo.find({
      where: { tenant_id: tenantId, revoked_at: IsNull() },
      order: { last_used_at: 'DESC' },
    });
    return sessions.map((s) => ({
      id: s.id,
      device_label: s.device_label,
      created_at: s.created_at,
      last_used_at: s.last_used_at,
    }));
  }

  async revokeSession(tenantId: string, sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, tenant_id: tenantId },
    });
    if (!session) {
      throw new BadRequestException('Sesión no encontrada');
    }
    session.revoked_at = new Date();
    await this.sessionRepo.save(session);
    return { revoked: true };
  }
}
