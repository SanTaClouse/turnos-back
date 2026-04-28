import { ApiProperty } from '@nestjs/swagger';

export class CreateBlockedSlotDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la empresa (tenant)',
  })
  tenant_id: string;

  @ApiProperty({
    example: '770e8400-e29b-41d4-a716-446655440000',
    description:
      'ID del recurso a bloquear (opcional). Si se omite, bloquea TODOS los recursos del tenant.',
    required: false,
  })
  resource_id?: string;

  @ApiProperty({
    example: '2026-04-15',
    description: 'Fecha del bloqueo (YYYY-MM-DD)',
  })
  date: string;

  @ApiProperty({
    example: '2026-04-20',
    description:
      'Fecha de fin para bloqueos multi-día (ej: vacaciones). Omitir para bloquear un solo día.',
    required: false,
  })
  end_date?: string;

  @ApiProperty({
    example: '13:00',
    description:
      'Hora de inicio del bloqueo (HH:MM). Omitir junto con end_time para bloquear el día completo.',
    required: false,
  })
  start_time?: string;

  @ApiProperty({
    example: '14:00',
    description:
      'Hora de fin del bloqueo (HH:MM). Omitir junto con start_time para bloquear el día completo.',
    required: false,
  })
  end_time?: string;

  @ApiProperty({
    example: 'Almuerzo',
    description: 'Razón del bloqueo (opcional)',
    required: false,
  })
  reason?: string;
}
