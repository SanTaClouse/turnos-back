import { ApiProperty } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiProperty({
    example: 'Juan García',
    description: 'Nombre del cliente',
    required: false,
  })
  name?: string;

  @ApiProperty({
    example: 'juan@example.com',
    description: 'Email del cliente',
    required: false,
  })
  email?: string;

  @ApiProperty({
    example: 'https://cdn.tuapp.com/clients/abc/avatar.jpg',
    description: 'URL del avatar del cliente',
    required: false,
  })
  picture?: string;
}
