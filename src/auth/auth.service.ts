import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OtpCode } from './otp-code.entity';
import { MailService } from '../mail/mail.service';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_MINUTES = 1;
const RATE_LIMIT_MAX = 3;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(OtpCode)
    private otpRepo: Repository<OtpCode>,
    private mailService: MailService,
    private jwtService: JwtService,
  ) {}

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Envía un código OTP al email. Limita la frecuencia.
   */
  async sendOtp(
    email: string,
  ): Promise<{ sent: true; expiresInMinutes: number }> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!this.isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Email inválido');
    }

    // Rate limit: no más de N códigos por minuto al mismo email
    const since = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000);
    const recentCount = await this.otpRepo.count({
      where: { email: normalizedEmail, created_at: LessThan(new Date()) },
    });
    if (recentCount > 0) {
      const recent = await this.otpRepo.find({
        where: { email: normalizedEmail },
        order: { created_at: 'DESC' },
        take: RATE_LIMIT_MAX,
      });
      const inWindow = recent.filter((r) => r.created_at >= since);
      if (inWindow.length >= RATE_LIMIT_MAX) {
        throw new BadRequestException(
          'Demasiados intentos. Esperá un minuto antes de pedir otro código.',
        );
      }
    }

    const code = this.generateCode();
    const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        email: normalizedEmail,
        code,
        expires_at,
        attempts: 0,
      }),
    );

    await this.mailService.sendOtp(normalizedEmail, code);

    return { sent: true, expiresInMinutes: OTP_TTL_MINUTES };
  }

  /**
   * Verifica el código OTP y devuelve un JWT firmado.
   */
  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ token: string; email: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!this.isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Email inválido');
    }
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('El código debe tener 6 dígitos');
    }

    const otp = await this.otpRepo.findOne({
      where: {
        email: normalizedEmail,
        code,
        consumed_at: IsNull(),
      },
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

    // Marcar como consumido
    otp.consumed_at = new Date();
    await this.otpRepo.save(otp);

    const token = await this.jwtService.signAsync(
      { email: normalizedEmail, scope: 'client' },
      { expiresIn: '30d' },
    );

    return { token, email: normalizedEmail };
  }
}
