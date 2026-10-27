import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { PageRequest } from './paginated.js';

export const PUBLIC_PAGE_SIZE = { default: 9, max: 50 } as const;
export const ADMIN_PAGE_SIZE = { default: 20, max: 100 } as const;

export class PublicPageQueryDto implements PageRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PUBLIC_PAGE_SIZE.max)
  pageSize: number = PUBLIC_PAGE_SIZE.default;
}

export class AdminPageQueryDto implements PageRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_PAGE_SIZE.max)
  pageSize: number = ADMIN_PAGE_SIZE.default;
}

export class AdminListQueryDto extends AdminPageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Matches(/^[A-Za-z]+:(asc|desc)$/, { message: 'sort must look like field:asc or field:desc' })
  sort?: string;
}
