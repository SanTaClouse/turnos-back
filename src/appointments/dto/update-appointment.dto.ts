import { ApiProperty } from '@nestjs/swagger';

export class UpdateAppointmentDto {
  @ApiProperty({
    example: 'El cliente prefiere corte degradado',
    description: 'Notas internas sobre el turno',
    required: false,
  })
  notes?: string;

  @ApiProperty({
    example: 4500,
    description:
      'Precio efectivamente cobrado. null/omitido para volver al precio del servicio.',
    required: false,
    nullable: true,
  })
  price_override?: number | null;
}
