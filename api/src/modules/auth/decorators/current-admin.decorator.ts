import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedAdmin } from '../mappers/admin.mapper.js';

export type AuthenticatedRequest = Request & { admin: AuthenticatedAdmin };

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedAdmin =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().admin,
);
