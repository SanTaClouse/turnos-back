import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from './appointments/appointments.module';
import { TenantsModule } from './tenants/tenants.module';
import { AvailabilityModule } from './availability/availability.module';
import { ClientsModule } from './clients/clients.module';
import { BlockedSlotsModule } from './blocked-slots/blocked-slots.module';
import { ServicesModule } from './services/services.module';
import { ResourcesModule } from './resources/resources.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true, // ⚠️ SOLO DEV
      }),
    }),
    AppointmentsModule,
    TenantsModule,
    AvailabilityModule,
    ClientsModule,
    BlockedSlotsModule,
    ServicesModule,
    ResourcesModule,
  ],
})
export class AppModule {}
