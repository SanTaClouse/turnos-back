import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'cliente@example.com',
    description: 'Email donde se envió el código',
  })
  email: string;

  @ApiProperty({
    example: '482910',
    description: 'Código de 6 dígitos recibido por email',
  })
  code: string;
}
