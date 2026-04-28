import { ApiProperty } from '@nestjs/swagger';

export class CreateAvailabilityDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la empresa (tenant)',
  })
  tenant_id: string;

  @ApiProperty({
    example: '660e8400-e29b-41d4-a716-446655440000',
    description: 'ID del recurso (profesional, sala, etc)',
  })
  resource_id: string;

  @ApiProperty({
    example: 1,
    description: 'Día de la semana (0=domingo, 1=lunes, ..., 6=sábado)',
  })
  day_of_week: number;

  @ApiProperty({
    example: '09:00',
    description: 'Hora de inicio (HH:MM)',
  })
  start_time: string;

  @ApiProperty({
    example: '17:00',
    description: 'Hora de fin (HH:MM)',
  })
  end_time: string;

  @ApiProperty({
    example: 30,
    description: 'Granularidad del horario en minutos (30, 60, etc)',
  })
  slot_duration: number;
}
