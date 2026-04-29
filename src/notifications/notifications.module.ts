import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription } from './push-subscription.entity';
import { NotificationLog } from './notification-log.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AppointmentEventListener } from './listeners/appointment.listener';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription, NotificationLog])],
  controllers: [NotificationsController],
  providers: [NotificationsService, AppointmentEventListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
