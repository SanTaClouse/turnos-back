import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppointmentsModule } from './appointments/appointments.module';
import { TenantsModule } from './tenants/tenants.module';
import { AvailabilityModule } from './availability/availability.module';
import { ClientsModule } from './clients/clients.module';
import { BlockedSlotsModule } from './blocked-slots/blocked-slots.module';
import { ServicesModule } from './services/services.module';
import { ResourcesModule } from './resources/resources.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExportsModule } from './exports/exports.module';
import { EarningsModule } from './earnings/earnings.module';
import { AiSummariesModule } from './ai-summaries/ai-summaries.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const isProd = configService.get<string>('NODE_ENV') === 'production';
        const sslEnabled =
          configService.get<string>('DATABASE_SSL') === 'true' || isProd;

        // SSL config: la mayoría de los providers (Render, Railway, Heroku,
        // Supabase, Neon) requieren SSL pero usan certificados firmados por
        // CAs no incluidas — rejectUnauthorized: false es seguro contra
        // MITM porque la conexión TLS sigue siendo encriptada.
        const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

        const common = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: true, // Auto-sync entities to database (safer than manual migrations for now)
          ssl,
          // Forzar schema 'public'. Algunos providers (Neon con Postgres 17/18)
          // arrancan el rol sin search_path, lo que rompe CREATE TABLE con
          // error 3F000 "no schema has been selected to create in".
          schema: 'public',
          // Pasa el search_path en el startup packet de Postgres (parámetro
          // `options` del protocolo). Se aplica ANTES de cualquier query y
          // sobrevive a poolers (PgBouncer en modo transaction), a diferencia
          // de un `SET search_path` ejecutado después del handshake.
          extra: {
            options: '-c search_path=public',
          },
        };

        // 1. DATABASE_URL (Render, Railway, Heroku, Supabase, etc.)
        if (databaseUrl) {
          return { ...common, url: databaseUrl };
        }

        // 2. Variables sueltas (dev local con docker-compose o postgres nativo)
        return {
          ...common,
          host: configService.get<string>('DB_HOST'),
          port: parseInt(configService.get<string>('DB_PORT') ?? '5432', 10),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
        };
      },
    }),
    AppointmentsModule,
    TenantsModule,
    AvailabilityModule,
    ClientsModule,
    BlockedSlotsModule,
    ServicesModule,
    ResourcesModule,
    MailModule,
    AuthModule,
    NotificationsModule,
    ExportsModule,
    EarningsModule,
    AiSummariesModule,
  ],
})
export class AppModule {}
