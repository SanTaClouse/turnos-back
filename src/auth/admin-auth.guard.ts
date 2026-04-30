import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import type { AuthedSession } from './admin-auth.service';

export interface AuthedRequest extends Request {
  authedSession: AuthedSession;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly adminAuth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta token de sesión');
    }
    const token = header.slice('Bearer '.length).trim();
    req.authedSession = await this.adminAuth.validateSession(token);
    return true;
  }
}
