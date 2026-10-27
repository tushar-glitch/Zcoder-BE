import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedRequest } from '../auth/decorators/current-admin.decorator.js';
import { AUDIT_ACTION_KEY, AUDIT_ENTITY_KEY } from './audit.decorator.js';
import { AuditService } from './audit.service.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(AUDIT_ACTION_KEY, context.getHandler());
    const entityType = this.reflector.get<string | undefined>(AUDIT_ENTITY_KEY, context.getClass());
    if (!action || !entityType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(tap((result) => void this.record(`${entityType}.${action}`, entityType, request, result)));
  }

  private record(action: string, entityType: string, request: Request, result: unknown): Promise<void> {
    return this.audit.record({
      adminId: (request as AuthenticatedRequest).admin?.id ?? null,
      action,
      entityType,
      entityId: this.entityIdOf(result) ?? this.idParamOf(request) ?? null,
      metadata: { fields: Object.keys(request.body ?? {}) },
    });
  }

  private idParamOf({ params }: Request): string | undefined {
    return typeof params.id === 'string' ? params.id : undefined;
  }

  private entityIdOf(result: unknown): string | undefined {
    const id = (result as { id?: unknown } | undefined)?.id;
    return typeof id === 'string' ? id : undefined;
  }
}
