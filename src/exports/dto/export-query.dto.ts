import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportQueryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId: string;

  @ApiProperty({ example: '2026-04-01' })
  from: string;

  @ApiProperty({ example: '2026-04-30' })
  to: string;

  @ApiPropertyOptional({
    description:
      'Coma-separated lista de status incluidos. Default: "confirmed".',
    example: 'confirmed',
  })
  status?: string;

  @ApiPropertyOptional({
    description:
      'Si se omite y existe un export previo idéntico, el endpoint /appointments.xlsx responde 409 con detalles.',
    example: 'true',
  })
  confirm?: string;
}
