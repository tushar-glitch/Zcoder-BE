import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../../common/pagination/page-query.dto.js';
import { Trim } from '../../../common/validation/trim.js';
import { InquiryStatus, InquiryType } from '../../../generated/prisma/client.js';

export class InquiryListQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;

  @IsOptional()
  @IsEnum(InquiryType)
  type?: InquiryType;
}

export class ChangeInquiryStatusDto {
  @IsIn([InquiryStatus.NEW, InquiryStatus.IN_PROGRESS])
  status: typeof InquiryStatus.NEW | typeof InquiryStatus.IN_PROGRESS;
}

export class SendReplyDto {
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject: string;

  @Trim()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  body: string;
}
