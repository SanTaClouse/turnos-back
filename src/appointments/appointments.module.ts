import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AvailabilityModule } from '../availability/availability.module';
import { ClientsModule } from '../clients/clients.module';
import { ResourcesModule } from '../resources/resources.module';
import { ServicesModule } from '../services/services.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MailModule } from '../mail/mail.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    AvailabilityModule,
    ClientsModule,
    ResourcesModule,
    ServicesModule,
    TenantsModule,
    MailModule,
    WhatsappModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
