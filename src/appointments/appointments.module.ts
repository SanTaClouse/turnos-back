import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AvailabilityModule } from '../availability/availability.module';
import { ClientsModule } from '../clients/clients.module';
import { ResourcesModule } from '../resources/resources.module';
import { ServicesModule } from '../services/services.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    AvailabilityModule,
    ClientsModule,
    ResourcesModule,
    ServicesModule,
    WhatsappModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
