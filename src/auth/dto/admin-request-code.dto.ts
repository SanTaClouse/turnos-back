import { ApiProperty } from '@nestjs/swagger';

export class AdminRequestCodeDto {
  @ApiProperty({
    example: 'dueno@negocio.com',
    description: 'Email del dueño del negocio (registrado durante el onboarding)',
  })
  email: string;
}
