import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: string;
  entityType: string;
}

export const Audit = (action: string, entityType: string): MethodDecorator =>
  SetMetadata<string, AuditMetadata>(AUDIT_KEY, { action, entityType });
