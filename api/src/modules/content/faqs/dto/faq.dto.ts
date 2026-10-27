import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Trim } from '../../../../common/validation/trim.js';

export class CreateFaqDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  question: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  answer: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  group?: string | null;

  @IsOptional()
  @IsBoolean()
  showOnHome?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}
