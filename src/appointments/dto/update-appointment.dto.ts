import { ApiProperty } from '@nestjs/swagger';

export class UpdateAppointmentDto {
  @ApiProperty({
    example: 'El cliente prefiere corte degradado',
    description: 'Notas internas sobre el turno',
    required: false,
  })
  notes?: string;
}
