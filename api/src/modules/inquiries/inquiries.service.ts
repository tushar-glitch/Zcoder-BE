import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import { parseSort } from '../../common/pagination/sort.js';
import { InquiryStatus } from '../../generated/prisma/client.js';
import type { ChangeInquiryStatusDto, InquiryListQueryDto } from './dto/inquiry-admin.dto.js';
import { InquiriesRepository, InquiryDetailRow } from './inquiries.repository.js';
import { InquiryResponse, InquirySummaryResponse, toInquiryResponse, toInquirySummary } from './inquiry.presenter.js';

const SORTABLE_FIELDS = ['createdAt', 'name'] as const;

@Injectable()
export class InquiriesService {
  constructor(private readonly repository: InquiriesRepository) {}

  async list({ status, type, q, sort, page, pageSize }: InquiryListQueryDto): Promise<Paginated<InquirySummaryResponse>> {
    const orderBy = parseSort(sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const { items, total } = await this.repository.findPage({ status, type, q }, orderBy, { page, pageSize });
    return Paginated.of(items.map(toInquirySummary), total, { page, pageSize });
  }

  async get(id: string): Promise<InquiryResponse> {
    return toInquiryResponse(await this.findOrThrow(id));
  }

  async delete(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.repository.delete(id);
  }

  async changeStatus(id: string, { status }: ChangeInquiryStatusDto): Promise<InquiryResponse> {
    const inquiry = await this.findOrThrow(id);
    if (inquiry.status === InquiryStatus.REPLIED && status === InquiryStatus.NEW) {
      throw new ConflictException('A replied inquiry can only move back to IN_PROGRESS');
    }

    if (inquiry.status !== status) {
      await this.repository.updateStatus(id, status);
    }
    return toInquiryResponse({ ...inquiry, status });
  }

  private async findOrThrow(id: string): Promise<InquiryDetailRow> {
    const inquiry = await this.repository.findById(id);
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }
    return inquiry;
  }
}
