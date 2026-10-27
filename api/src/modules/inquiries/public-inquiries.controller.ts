import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.constants.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { CreateInquiryDto } from './dto/create-inquiry.dto.js';
import { InquirySubmissionService, SubmissionAck } from './inquiry-submission.service.js';

@Public()
@Controller('public/inquiries')
export class PublicInquiriesController {
  constructor(private readonly submission: InquirySubmissionService) {}

  @Post()
  @Throttle({ default: RATE_LIMITS.inquiry })
  submit(@Body() dto: CreateInquiryDto): Promise<SubmissionAck> {
    return this.submission.submit(dto);
  }
}
