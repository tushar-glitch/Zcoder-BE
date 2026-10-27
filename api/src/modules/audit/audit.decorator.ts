import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';
export const AUDIT_ENTITY_KEY = 'auditEntity';

export const AuditEntity = (entityType: string): ClassDecorator => SetMetadata(AUDIT_ENTITY_KEY, entityType);

export const Audit = (action: string): MethodDecorator => SetMetadata(AUDIT_ACTION_KEY, action);
