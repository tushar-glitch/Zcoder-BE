import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ACCESS_COOKIE } from '../auth.constants.js';
import type { AuthenticatedRequest } from '../decorators/current-admin.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { TokenService } from '../security/token.service.js';
import { SessionRepository } from '../session.repository.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token: string | undefined = request.cookies?.[ACCESS_COOKIE];
    const payload = token ? await this.tokens.verifyAccessToken(token) : null;
    const session = payload ? await this.sessions.findActiveById(payload.sessionId, new Date()) : null;

    if (!session || session.adminId !== payload?.adminId) {
      throw new UnauthorizedException('Authentication required');
    }

    const { id, name, email, role, lastLoginAt } = session.admin;
    (request as AuthenticatedRequest).admin = { id, name, email, role, lastLoginAt, sessionId: session.id };
    return true;
  }
}
