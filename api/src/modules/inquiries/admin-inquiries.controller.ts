import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import { UuidParam } from '../../common/pipes/uuid-param.js';
import { Audit, AuditEntity } from '../audit/audit.decorator.js';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/mappers/admin.mapper.js';
import { ChangeInquiryStatusDto, InquiryListQueryDto, SendReplyDto } from './dto/inquiry-admin.dto.js';
import { InquiriesService } from './inquiries.service.js';
import { InquiryRepliesService } from './inquiry-replies.service.js';
import type { InquiryResponse, InquirySummaryResponse, ReplyOutcome } from './inquiry.presenter.js';

@Controller('admin/inquiries')
@AuditEntity('inquiry')
export class AdminInquiriesController {
  constructor(
    private readonly inquiries: InquiriesService,
    private readonly replies: InquiryRepliesService,
  ) {}

  @Get()
  list(@Query() query: InquiryListQueryDto): Promise<Paginated<InquirySummaryResponse>> {
    return this.inquiries.list(query);
  }

  @Get(':id')
  get(@UuidParam() id: string): Promise<InquiryResponse> {
    return this.inquiries.get(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.inquiries.delete(id);
  }

  @Patch(':id/status')
  @Audit('status')
  changeStatus(@UuidParam() id: string, @Body() dto: ChangeInquiryStatusDto): Promise<InquiryResponse> {
    return this.inquiries.changeStatus(id, dto);
  }

  @Post(':id/replies')
  @Audit('reply')
  reply(@UuidParam() id: string, @Body() dto: SendReplyDto, @CurrentAdmin() admin: AuthenticatedAdmin): Promise<ReplyOutcome> {
    return this.replies.send(id, admin.id, dto);
  }

  @Post(':id/replies/:replyId/retry')
  @HttpCode(HttpStatus.OK)
  @Audit('reply-retry')
  retry(@UuidParam() id: string, @UuidParam('replyId') replyId: string): Promise<ReplyOutcome> {
    return this.replies.retry(id, replyId);
  }
}
