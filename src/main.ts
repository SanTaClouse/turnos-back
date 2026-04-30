import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: lista en CORS_ORIGINS separada por comas + localhost dev por default.
  // Ej: CORS_ORIGINS=https://turnosapp.vercel.app,https://turnosapp.com
  const corsEnv = process.env.CORS_ORIGINS;
  const defaultOrigins = ['http://localhost:3001', 'http://localhost:3002'];
  const origin = corsEnv
    ? corsEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : defaultOrigins;

  app.enableCors({
    origin,
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

  const port = parseInt(process.env.PORT ?? '3000', 10);
  // 0.0.0.0 es importante para que la mayoría de los providers (Render, Railway,
  // Heroku, Fly) puedan rutear tráfico al contenedor.
  await app.listen(port, '0.0.0.0');
  console.log(`✅ API listening on port ${port}`);
  console.log(`📚 Swagger en /api/docs`);
}
bootstrap();
