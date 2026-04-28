import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({
    example: 'Barbería Juan',
    description: 'Nombre de la empresa',
  })
  name: string;

  @ApiProperty({
    example: 'barberia-juan',
    description: 'Slug para URL pública (ej: tuapp.com/barberia-juan)',
  })
  slug: string;

  @ApiProperty({
    example: '+541234567890',
    description: 'Número de WhatsApp Business de la empresa',
  })
  whatsapp_number: string;

  @ApiProperty({
    example: 'America/Argentina/Buenos_Aires',
    description: 'Zona horaria del negocio (IANA timezone)',
    required: false,
  })
  timezone?: string;

  @ApiProperty({
    example: 'ARS',
    description: 'Moneda del negocio (ISO 4217)',
    required: false,
  })
  currency?: string;

  @ApiProperty({
    example: 'es-AR',
    description: 'Locale para formateo de fechas y números',
    required: false,
  })
  locale?: string;

  @ApiProperty({
    example: 'Barbería tradicional con más de 20 años en el barrio.',
    description: 'Descripción del negocio para la landing pública',
    required: false,
  })
  description?: string;

  @ApiProperty({
    example: 'Av. Siempre Viva 742, Springfield',
    description: 'Dirección física del negocio',
    required: false,
  })
  address?: string;

  @ApiProperty({
    example: 'https://cdn.tuapp.com/tenants/abc/logo.png',
    description: 'URL del logo del negocio',
    required: false,
  })
  logo_url?: string;

  @ApiProperty({
    example: 'https://cdn.tuapp.com/tenants/abc/cover.jpg',
    description: 'URL de la imagen de portada para la landing pública',
    required: false,
  })
  cover_url?: string;

  @ApiProperty({
    example: true,
    description: 'Si la landing pública está visible (default true)',
    required: false,
  })
  is_public?: boolean;
}
