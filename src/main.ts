import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Swagger/OpenAPI Configuration
  const config = new DocumentBuilder()
    .setTitle('Turnos por WhatsApp - API')
    .setDescription(
      'API para gestionar turnos de múltiples empresas. ' +
        'Solución SaaS simple, rápida y eficiente.',
    )
    .setVersion('1.0.0')
    .addTag('Tenants', 'Gestión de empresas')
    .addTag('Availability', 'Reglas de disponibilidad')
    .addTag('Appointments', 'Gestión de turnos')
    .addTag('Blocked Slots', 'Horarios bloqueados')
    .addTag('WhatsApp', 'Webhooks de WhatsApp')
    .addServer('http://localhost:3000', 'Desarrollo local')
    .addServer('https://api.tudominio.com', 'Producción')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerUrl: '/api/docs',
    swaggerOptions: {
      supportedSubmitMethods: ['get', 'post', 'put', 'patch', 'delete'],
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `✅ API ejecutando en http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `📚 Documentación Swagger en http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}
bootstrap();
