import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdminListQueryDto } from '../../../../common/pagination/page-query.dto.js';
import { IsSlug } from '../../../../common/slug/slug.js';
import { IsHttpUrl, IsStringList } from '../../../../common/validation/field-validators.js';
import { Trim } from '../../../../common/validation/trim.js';
import { IsNullableUuid } from '../../../../common/validation/uuid-validators.js';

export const MAX_GALLERY_IMAGES = 20;

export class CreateProjectDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsStringList(20, 40)
  technologies?: string[];

  @IsNullableUuid()
  coverImageId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GALLERY_IMAGES)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  galleryImageIds?: string[];

  @IsHttpUrl()
  demoUrl?: string | null;

  @IsHttpUrl()
  sourceUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string | null;

  @IsNullableUuid()
  ogImageId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class ProjectListQueryDto extends AdminListQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  published?: boolean;
}
