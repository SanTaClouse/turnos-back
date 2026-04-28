import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la empresa (tenant)',
  })
  tenant_id: string;

  @ApiProperty({
    example: '660e8400-e29b-41d4-a716-446655440000',
    description: 'ID del servicio solicitado',
  })
  service_id: string;

  @ApiProperty({
    example: '2026-04-15',
    description: 'Fecha del turno (YYYY-MM-DD)',
  })
  date: string;

  @ApiProperty({
    example: '10:30',
    description: 'Hora del turno (HH:MM)',
  })
  time: string;

  @ApiProperty({
    example: '+541234567890',
    description: 'Teléfono del cliente',
  })
  client_phone: string;

  @ApiProperty({
    example: 'Juan García',
    description: 'Nombre del cliente (opcional)',
    required: false,
  })
  client_name?: string;

  @ApiProperty({
    example: '770e8400-e29b-41d4-a716-446655440000',
    description:
      'ID del recurso preferido (opcional, se auto-asigna si no se especifica)',
    required: false,
  })
  resource_id?: string;
}
