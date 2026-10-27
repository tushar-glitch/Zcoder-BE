import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { IsSlug } from '../../../../common/slug/slug.js';
import { IsStringList } from '../../../../common/validation/field-validators.js';
import { Trim } from '../../../../common/validation/trim.js';
import { IsNullableUuid } from '../../../../common/validation/uuid-validators.js';

export class CreateServiceDto {
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
  @MaxLength(40)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsStringList(20, 40)
  technologies?: string[];

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
  isPublished?: boolean;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
