import { ApiProperty } from '@nestjs/swagger';

export class AdminVerifyDto {
  @ApiProperty({
    example: 'dueno@negocio.com',
    description: 'Email al que se envió el código',
  })
  email: string;

  @ApiProperty({
    example: '482917',
    description: 'Código de 6 dígitos recibido por email',
  })
  code: string;
}
