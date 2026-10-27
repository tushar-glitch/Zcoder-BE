import type { AuditLogWithAdmin } from './audit.repository.js';

export interface AuditLogResponse {
  id: string;
  admin: { id: string; name: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
}

export function toAuditLogResponse({
  id,
  admin,
  action,
  entityType,
  entityId,
  metadata,
  createdAt,
}: AuditLogWithAdmin): AuditLogResponse {
  return { id, admin, action, entityType, entityId, metadata, createdAt };
}
