import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import type { AuthedRequest } from './admin-auth.guard';
import { AdminRequestCodeDto } from './dto/admin-request-code.dto';
import { AdminVerifyDto } from './dto/admin-verify.dto';

function getClientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.ip ?? null;
}

@ApiTags('Auth Admin')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}

  @Post('request-code')
  @ApiOperation({
    summary: 'Pedir código OTP para login del admin del tenant',
    description:
      'Envía un código de 6 dígitos al email del dueño. Por seguridad, ' +
      'devuelve éxito incluso si el email no está registrado (no expone qué ' +
      'emails existen). Rate limit: 3 códigos por minuto.',
  })
  @ApiOkResponse({
    schema: { example: { sent: true, expiresInMinutes: 10 } },
  })
  @ApiBadRequestResponse({ description: 'Email inválido o rate limit' })
  requestCode(@Body() dto: AdminRequestCodeDto) {
    return this.service.requestCode(dto.email);
  }

  @Post('verify')
  @ApiOperation({
    summary: 'Verificar código y crear session persistente',
    description:
      'Si el código es correcto, crea una session ligada al device (User-Agent) ' +
      'y devuelve un token opaco para guardar en cookie httpOnly.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        session_token: 'gA9Bf7K2pQ...',
        tenant: { id: 'uuid', name: 'Barbería Juan', slug: 'barberia-juan' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Código inválido, expirado o consumido' })
  verify(
    @Body() dto: AdminVerifyDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() req: Request,
  ) {
    return this.service.verifyCode(
      dto.email,
      dto.code,
      userAgent ?? null,
      getClientIp(req),
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({
    summary: 'Devolver el tenant + session actual a partir del session token',
  })
  @ApiOkResponse({
    schema: {
      example: {
        tenant: { id: 'uuid', name: 'Barbería Juan', slug: 'barberia-juan', email: 'dueno@negocio.com' },
        session: { id: 'uuid', device_label: 'iPhone · Safari' },
      },
    },
  })
  me(@Req() req: AuthedRequest) {
    const { tenant, session } = req.authedSession;
    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        whatsapp_number: tenant.whatsapp_number,
        timezone: tenant.timezone,
        currency: tenant.currency,
        locale: tenant.locale,
      },
      session: {
        id: session.id,
        device_label: session.device_label,
        created_at: session.created_at,
        last_used_at: session.last_used_at,
      },
    };
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Cerrar la sesión actual (revoca el token)' })
  @ApiOkResponse({ schema: { example: { revoked: true } } })
  logout(@Req() req: AuthedRequest) {
    return this.service.revokeSession(
      req.authedSession.tenant.id,
      req.authedSession.session.id,
    );
  }

  @Get('sessions')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Listar sesiones activas del tenant' })
  listSessions(@Req() req: AuthedRequest) {
    return this.service.listSessions(req.authedSession.tenant.id);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Revocar una sesión específica del tenant' })
  revokeSession(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.revokeSession(req.authedSession.tenant.id, id);
  }
}
