import { randomUUID } from 'node:crypto';
import type { AuditLog, Media } from '../../src/generated/prisma/client.js';
import { Prisma } from '../../src/generated/prisma/client.js';
import { FileStorage } from '../../src/infrastructure/storage/file-storage.js';
import type { PageRequest } from '../../src/common/pagination/paginated.js';
import type { AuditEntry, AuditFilters, AuditLogWithAdmin } from '../../src/modules/audit/audit.repository.js';
import type { MediaQuery, NewMedia } from '../../src/modules/media/media.repository.js';
import type { InMemoryAdminRepository } from './in-memory-auth.js';

export class InMemoryAuditRepository {
  readonly entries: AuditLog[] = [];

  constructor(private readonly admins: InMemoryAdminRepository) {}

  async create({ metadata, entityId, ...entry }: AuditEntry): Promise<void> {
    this.entries.push({
      id: randomUUID(),
      entityId: entityId ?? null,
      metadata: (metadata ?? {}) as Prisma.JsonValue,
      createdAt: new Date(),
      ...entry,
    });
  }

  async findPage(filters: AuditFilters, { page, pageSize }: PageRequest) {
    const matching = this.entries
      .filter((entry) => Object.entries(filters).every(([key, value]) => !value || entry[key as keyof AuditFilters] === value))
      .reverse();
    const items = matching.slice((page - 1) * pageSize, page * pageSize).map((entry) => this.withAdmin(entry));
    return { items, total: matching.length };
  }

  async findRecent(limit: number): Promise<AuditLogWithAdmin[]> {
    return [...this.entries].reverse().slice(0, limit).map((entry) => this.withAdmin(entry));
  }

  private withAdmin(entry: AuditLog): AuditLogWithAdmin {
    const admin = entry.adminId ? this.admins.admins.get(entry.adminId) : undefined;
    return { ...entry, admin: admin ? { id: admin.id, name: admin.name } : null };
  }
}

export class InMemoryFileStorage extends FileStorage {
  readonly files = new Map<string, Buffer>();

  async put(key: string, data: Buffer): Promise<void> {
    this.files.set(key, data);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  urlFor(key: string): string {
    return `http://localhost:4000/uploads/${key}`;
  }
}

export class InMemoryMediaRepository {
  readonly items = new Map<string, Media>();
  readonly inUse = new Set<string>();

  async create(media: NewMedia): Promise<Media> {
    const created: Media = { id: randomUUID(), createdAt: new Date(), ...media };
    this.items.set(created.id, created);
    return created;
  }

  async findById(id: string): Promise<Media | null> {
    return this.items.get(id) ?? null;
  }

  async findPage({ q, orderBy }: MediaQuery, { page, pageSize }: PageRequest) {
    const needle = q?.toLowerCase();
    const [[field, direction]] = Object.entries(orderBy) as [['createdAt' | 'fileName', 'asc' | 'desc']];
    const matching = [...this.items.values()]
      .filter((media) => !needle || `${media.fileName} ${media.altText}`.toLowerCase().includes(needle))
      .sort((a, b) => (a[field] > b[field] ? 1 : -1) * (direction === 'asc' ? 1 : -1));
    return { items: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length };
  }

  async updateAltText(id: string, altText: string): Promise<Media> {
    const media = this.items.get(id)!;
    media.altText = altText;
    return media;
  }

  async delete(id: string): Promise<void> {
    if (this.inUse.has(id)) {
      throw new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: 'test',
      });
    }
    this.items.delete(id);
  }
}
