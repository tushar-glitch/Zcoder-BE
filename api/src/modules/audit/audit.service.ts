import { Injectable, Logger } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import type { PageRequest } from '../../common/pagination/paginated.js';
import { AuditEntry, AuditFilters, AuditRepository } from './audit.repository.js';
import { AuditLogResponse, toAuditLogResponse } from './audit-log.mapper.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repository: AuditRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repository.create(entry);
    } catch (error) {
      this.logger.error(`Could not record audit entry ${entry.action}`, error instanceof Error ? error.stack : undefined);
    }
  }

  async list(filters: AuditFilters, page: PageRequest): Promise<Paginated<AuditLogResponse>> {
    const { items, total } = await this.repository.findPage(filters, page);
    return Paginated.of(items.map(toAuditLogResponse), total, page);
  }

  async recent(limit: number): Promise<AuditLogResponse[]> {
    return (await this.repository.findRecent(limit)).map(toAuditLogResponse);
  }
}
