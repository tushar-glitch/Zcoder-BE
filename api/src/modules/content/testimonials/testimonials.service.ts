import { Injectable } from '@nestjs/common';
import { ValidationException } from '../../../common/exceptions/validation.exception.js';
import { RevalidationService } from '../../../infrastructure/revalidation/revalidation.service.js';
import { MediaReferences } from '../../media/media-references.js';
import { MediaPresenter } from '../../media/media.presenter.js';
import type { MediaRef } from '../../media/media.presenter.js';
import { ContentService } from '../content.service.js';
import type { CreateTestimonialDto, UpdateTestimonialDto } from './dto/testimonial.dto.js';
import { TestimonialData, TestimonialRow, TestimonialsRepository } from './testimonials.repository.js';

export interface TestimonialResponse {
  id: string;
  clientName: string;
  clientRole: string | null;
  company: string | null;
  quote: string;
  avatar: MediaRef | null;
  rating: number | null;
  clientApproved: boolean;
  isPublished: boolean;
  sortOrder: number;
}

@Injectable()
export class TestimonialsService extends ContentService<
  TestimonialRow,
  TestimonialResponse,
  CreateTestimonialDto,
  UpdateTestimonialDto,
  TestimonialData
> {
  constructor(
    repository: TestimonialsRepository,
    revalidation: RevalidationService,
    private readonly media: MediaPresenter,
    private readonly mediaReferences: MediaReferences,
  ) {
    super(repository, revalidation, 'Testimonial');
  }

  protected present(row: TestimonialRow): TestimonialResponse {
    return {
      id: row.id,
      clientName: row.clientName,
      clientRole: row.clientRole,
      company: row.company,
      quote: row.quote,
      avatar: this.media.refOrNull(row.avatar),
      rating: row.rating,
      clientApproved: row.clientApproved,
      isPublished: row.isPublished,
      sortOrder: row.sortOrder,
    };
  }

  protected async toData(dto: CreateTestimonialDto | UpdateTestimonialDto): Promise<Partial<TestimonialData>> {
    return {
      clientName: dto.clientName ?? undefined,
      clientRole: dto.clientRole,
      company: dto.company,
      quote: dto.quote ?? undefined,
      avatarId: dto.avatarId,
      rating: dto.rating,
      clientApproved: dto.clientApproved ?? undefined,
      isPublished: dto.isPublished ?? undefined,
      sortOrder: dto.sortOrder ?? undefined,
    };
  }

  protected revalidationTags(): string[] {
    return ['testimonials'];
  }

  protected async validateCreate(dto: CreateTestimonialDto): Promise<void> {
    await this.mediaReferences.assertExist({ avatarId: dto.avatarId });
    this.assertApprovedToPublish(dto.isPublished ?? false, dto.clientApproved ?? false);
  }

  protected async validateUpdate(current: TestimonialRow, dto: UpdateTestimonialDto): Promise<void> {
    await this.mediaReferences.assertExist({ avatarId: dto.avatarId });
    this.assertApprovedToPublish(dto.isPublished ?? current.isPublished, dto.clientApproved ?? current.clientApproved);
  }

  private assertApprovedToPublish(isPublished: boolean, clientApproved: boolean): void {
    if (isPublished && !clientApproved) {
      throw new ValidationException([
        { path: 'clientApproved', message: 'clientApproved must be true before a testimonial can be published' },
      ]);
    }
  }
}
