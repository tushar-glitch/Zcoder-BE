import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Environment } from '../../../config/environment.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../auth.constants.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(config: ConfigService<Environment, true>) {
    this.allowedOrigin = new URL(config.get('APP_URL', { infer: true })).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!STATE_CHANGING_METHODS.has(request.method) || !this.carriesSession(request)) {
      return true;
    }
    if (this.originOf(request) !== this.allowedOrigin) {
      throw new ForbiddenException('Origin not allowed');
    }
    return true;
  }

  private carriesSession(request: Request): boolean {
    return Boolean(request.cookies?.[ACCESS_COOKIE] || request.cookies?.[REFRESH_COOKIE]);
  }

  private originOf({ headers }: Request): string | undefined {
    if (headers.origin) {
      return headers.origin;
    }
    try {
      return headers.referer ? new URL(headers.referer).origin : undefined;
    } catch {
      return undefined;
    }
  }
}
