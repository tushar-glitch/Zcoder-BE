import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsSlug } from '../../../common/slug/slug.js';
import { Trim } from '../../../common/validation/trim.js';

export class CreateTaxonomyDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;
}

export class UpdateTaxonomyDto extends PartialType(CreateTaxonomyDto) {}
