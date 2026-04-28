import { ApiProperty } from '@nestjs/swagger';

export class CreateResourceDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la empresa (tenant)',
  })
  tenant_id: string;

  @ApiProperty({
    example: 'Peluquero Juan',
    description: 'Nombre del recurso (profesional, sala, cancha, etc)',
  })
  name: string;

  @ApiProperty({
    example: 'Barbero senior',
    description: 'Rol o título del recurso',
    required: false,
  })
  role?: string;

  @ApiProperty({
    example: 24,
    description: 'Hue HSL (0-360) para el color del avatar',
    required: false,
  })
  hue?: number;

  @ApiProperty({
    example: ['uuid-service-1', 'uuid-service-2'],
    description: 'IDs de los servicios que este recurso puede realizar',
    required: false,
  })
  service_ids?: string[];
}
