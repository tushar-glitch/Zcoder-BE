import { Module } from '@nestjs/common';
import { AdminInquiriesController } from './admin-inquiries.controller.js';
import { InquiriesRepository } from './inquiries.repository.js';
import { InquiriesService } from './inquiries.service.js';
import { InquiryNotifier } from './inquiry-notifier.js';
import { InquiryRepliesService } from './inquiry-replies.service.js';
import { InquirySubmissionService } from './inquiry-submission.service.js';
import { PublicInquiriesController } from './public-inquiries.controller.js';

@Module({
  controllers: [AdminInquiriesController, PublicInquiriesController],
  providers: [InquiriesService, InquiryRepliesService, InquirySubmissionService, InquiryNotifier, InquiriesRepository],
  exports: [InquiriesRepository],
})
export class InquiriesModule {}
