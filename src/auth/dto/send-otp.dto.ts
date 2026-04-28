import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    example: 'cliente@example.com',
    description: 'Email del cliente que quiere ver sus turnos',
  })
  email: string;
}
