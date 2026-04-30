import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OtpCode } from './otp-code.entity';
import { Session } from './session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthGuard } from './admin-auth.guard';
import { Tenant } from '../tenants/tenant.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OtpCode, Session, Tenant]),
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-prod',
      }),
    }),
  ],
  providers: [AuthService, AdminAuthService, AdminAuthGuard],
  controllers: [AuthController, AdminAuthController],
  exports: [AuthService, AdminAuthService, AdminAuthGuard, JwtModule],
})
export class AuthModule {}
