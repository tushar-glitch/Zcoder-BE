import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AdminListQueryDto } from '../../../common/pagination/page-query.dto.js';
import { Trim } from '../../../common/validation/trim.js';
import { BlogStatus } from '../../../generated/prisma/client.js';
import type { ContentFormat } from '../blog.presenter.js';

export class BlogListQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class SlugAvailableQueryDto {
  @Trim()
  @IsString()
  @MaxLength(120)
  slug: string;

  @IsOptional()
  @IsUUID()
  excludeId?: string;
}

export class ContentFormatQueryDto {
  @IsOptional()
  @IsIn(['html', 'json'])
  format: ContentFormat = 'html';
}
