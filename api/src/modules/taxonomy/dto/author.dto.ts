import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsSlug } from '../../../common/slug/slug.js';
import { IsNullableUuid } from '../../../common/validation/uuid-validators.js';
import { Trim } from '../../../common/validation/trim.js';

export class CreateAuthorDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsNullableUuid()
  avatarId?: string | null;
}

export class UpdateAuthorDto extends PartialType(CreateAuthorDto) {}
