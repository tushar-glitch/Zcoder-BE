import { Controller, Get, Query } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import { AuditLogResponse } from './audit-log.mapper.js';
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js';
import { AuditService } from './audit.service.js';

@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() { entityType, entityId, adminId, page, pageSize }: AuditLogQueryDto): Promise<Paginated<AuditLogResponse>> {
    return this.audit.list({ entityType, entityId, adminId }, { page, pageSize });
  }
}
