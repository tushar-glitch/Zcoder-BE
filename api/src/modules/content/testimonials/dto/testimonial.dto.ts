import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Trim } from '../../../../common/validation/trim.js';
import { IsNullableUuid } from '../../../../common/validation/uuid-validators.js';

export class CreateTestimonialDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  clientName: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientRole?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  company?: string | null;

  @Trim()
  @IsString()
  @MinLength(20)
  @MaxLength(600)
  quote: string;

  @IsNullableUuid()
  avatarId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  clientApproved?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}
