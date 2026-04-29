import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Availability } from './availability.entity';
import { Appointment } from '../appointments/appointment.entity';
import { BlockedSlot } from '../blocked-slots/blocked-slot.entity';
import { Tenant } from '../tenants/tenant.entity';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { ResourcesModule } from '../resources/resources.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Availability, Appointment, BlockedSlot, Tenant]),
    ResourcesModule,
    ServicesModule,
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
