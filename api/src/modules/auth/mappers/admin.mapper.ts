import type { Admin } from '../../../generated/prisma/client.js';

export type AdminProfile = Pick<Admin, 'id' | 'name' | 'email' | 'role' | 'lastLoginAt'>;

export type AuthenticatedAdmin = AdminProfile & { sessionId: string };

export function toAdminResponse({ id, name, email, role, lastLoginAt }: AdminProfile): AdminProfile {
  return { id, name, email, role, lastLoginAt };
}
