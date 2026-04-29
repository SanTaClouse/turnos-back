import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription } from './push-subscription.entity';
import { NotificationLog } from './notification-log.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AppointmentEventListener } from './listeners/appointment.listener';
import { Appointment } from '../appointments/appointment.entity';
import { Client } from '../clients/client.entity';
import { Tenant } from '../tenants/tenant.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PushSubscription,
      NotificationLog,
      Appointment,
      Client,
      Tenant,
    ]),
    MailModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, AppointmentEventListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
