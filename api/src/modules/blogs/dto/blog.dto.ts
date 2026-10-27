import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxDate,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsSlug } from '../../../common/slug/slug.js';
import { Trim } from '../../../common/validation/trim.js';
import { IsNullableUuid, IsOptionalUuid } from '../../../common/validation/uuid-validators.js';

export const BLOG_TITLE_MAX = 120;
export const MAX_TAGS_PER_BLOG = 10;

class BlogFieldsDto {
  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  contentJson?: Record<string, unknown>;

  @IsNullableUuid()
  coverImageId?: string | null;

  @IsOptionalUuid()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS_PER_BLOG)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tagIds?: string[];

  @IsOptionalUuid()
  authorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string;

  @IsNullableUuid()
  ogImageId?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MaxDate(() => new Date(), { message: 'publishedAt cannot be in the future' })
  publishedAt?: Date;
}

export class CreateBlogDto extends BlogFieldsDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(BLOG_TITLE_MAX)
  title: string;
}

export class UpdateBlogDto extends BlogFieldsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(BLOG_TITLE_MAX)
  title?: string;
}
