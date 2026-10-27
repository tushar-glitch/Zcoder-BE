import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { InquirySource, InquiryType } from '../../../generated/prisma/client.js';
import { Trim } from '../../../common/validation/trim.js';

export const BUDGET_RANGES = ['LT_1K', '1K_5K', '5K_15K', 'GT_15K', 'NOT_SURE'] as const;
export const TIMELINES = ['ASAP', '1_3_MONTHS', '3_6_MONTHS', 'FLEXIBLE'] as const;

const lowerCase = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class CreateInquiryDto {
  @IsEnum(InquiryType)
  type: InquiryType;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @lowerCase()
  @IsEmail()
  @MaxLength(120)
  email: string;

  @ValidateIf((dto: CreateInquiryDto) => dto.type === InquiryType.CONTACT || dto.subject !== undefined)
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject?: string;

  @Trim()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ValidateIf((dto: CreateInquiryDto) => dto.type === InquiryType.PROJECT || dto.serviceInterest !== undefined)
  @Trim()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "serviceInterest must be a service slug or 'other'" })
  serviceInterest?: string;

  @IsOptional()
  @IsIn(BUDGET_RANGES)
  budgetRange?: string;

  @IsOptional()
  @IsIn(TIMELINES)
  timeline?: string;

  @IsOptional()
  @IsEnum(InquirySource)
  source?: InquirySource;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  sourcePage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsInt()
  renderedAt?: number;
}
