import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la empresa (tenant)',
  })
  tenant_id: string;

  @ApiProperty({
    example: 'Corte de pelo',
    description: 'Nombre del servicio',
  })
  name: string;

  @ApiProperty({
    example: 30,
    description: 'Duración del servicio en minutos',
  })
  duration_minutes: number;

  @ApiProperty({
    example: 10,
    description: 'Minutos de buffer entre turnos (limpieza, preparación, etc)',
    required: false,
  })
  buffer_minutes?: number;

  @ApiProperty({
    example: 8000,
    description: 'Precio del servicio (en moneda del tenant)',
    required: false,
  })
  price?: number;

  @ApiProperty({
    example: 'Corte clásico o moderno',
    description: 'Descripción visible al cliente',
    required: false,
  })
  description?: string;
}
