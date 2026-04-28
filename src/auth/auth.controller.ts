import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('otp/send')
  @ApiOperation({
    summary: 'Enviar código OTP al email del cliente',
    description:
      'Genera un código de 6 dígitos, lo guarda con TTL de 10min y lo envía por email vía Resend. ' +
      'Rate-limited: máximo 3 códigos por minuto al mismo email.',
  })
  @ApiOkResponse({
    description: 'Código enviado',
    schema: { example: { sent: true, expiresInMinutes: 10 } },
  })
  @ApiBadRequestResponse({ description: 'Email inválido o rate limit' })
  send(@Body() dto: SendOtpDto) {
    return this.service.sendOtp(dto.email);
  }

  @Post('otp/verify')
  @ApiOperation({
    summary: 'Verificar código OTP y devolver JWT',
    description:
      'Si el código es correcto y no expiró, devuelve un JWT con scope=client válido por 30 días.',
  })
  @ApiOkResponse({
    description: 'Verificado',
    schema: {
      example: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        email: 'cliente@example.com',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Código incorrecto, expirado o consumido',
  })
  verify(@Body() dto: VerifyOtpDto) {
    return this.service.verifyOtp(dto.email, dto.code);
  }
}
