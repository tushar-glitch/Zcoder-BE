import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AdminPageQueryDto } from '../../../common/pagination/page-query.dto.js';

export class AuditLogQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  adminId?: string;
}
