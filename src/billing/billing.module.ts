import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Tenant } from '../tenants/tenant.entity';
import { Client } from '../clients/client.entity';
import { Payment } from './payment.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PlatformController } from './platform.controller';
import { MercadoPagoService } from './mercadopago.service';
import { BillingCronService } from './billing-cron.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Client, Payment]),
    ConfigModule,
    AuthModule, // para el AdminAuthGuard en los endpoints protegidos
    NotificationsModule, // para mandar recordatorios push desde el cron
    MailModule, // para mandar recordatorios por email desde el cron
  ],
  controllers: [BillingController, PlatformController],
  providers: [
    BillingService,
    MercadoPagoService,
    BillingCronService,
    PlatformAdminGuard,
  ],
  exports: [BillingService],
})
export class BillingModule {}
