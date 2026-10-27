import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Trim } from '../../../common/validation/trim.js';
import { IsNullableUuid } from '../../../common/validation/uuid-validators.js';

export const CTA_LABEL_MAX = 30;
const CTA_URL_PATTERN = /^(\/(?!\/)\S*|https:\/\/\S+)$/;

export class CtaLinkDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(CTA_LABEL_MAX)
  label: string;

  @Trim()
  @IsString()
  @MaxLength(300)
  @Matches(CTA_URL_PATTERN, { message: 'url must start with / or https://' })
  url: string;
}

export class CreateHeroDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  heading?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subheading?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CtaLinkDto)
  primaryCta?: CtaLinkDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CtaLinkDto)
  secondaryCta?: CtaLinkDto | null;

  @IsNullableUuid()
  imageId?: string | null;
}

export class UpdateHeroDto extends PartialType(CreateHeroDto) {}
