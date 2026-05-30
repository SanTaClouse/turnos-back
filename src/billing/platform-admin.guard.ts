import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guard para los endpoints de administración de la PLATAFORMA (uso del dueño,
 * vos). No es la auth de los tenants: protege con una clave secreta enviada en
 * el header `x-admin-key`, comparada contra PLATFORM_ADMIN_KEY del entorno.
 *
 * Simple y suficiente para un único operador. Si en el futuro hay varios
 * admins conviene migrar a un login propio.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('PLATFORM_ADMIN_KEY');
    if (!expected) {
      throw new InternalServerErrorException(
        'PLATFORM_ADMIN_KEY no configurado en el backend',
      );
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-admin-key'];
    if (provided !== expected) {
      throw new UnauthorizedException('Clave de administrador inválida');
    }
    return true;
  }
}
