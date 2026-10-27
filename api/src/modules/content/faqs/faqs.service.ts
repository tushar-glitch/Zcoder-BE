import { ConflictException, Injectable } from '@nestjs/common';
import type { Faq } from '../../../generated/prisma/client.js';
import { RevalidationService } from '../../../infrastructure/revalidation/revalidation.service.js';
import { ContentService } from '../content.service.js';
import type { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto.js';
import { FaqData, FaqsRepository } from './faqs.repository.js';

export interface FaqResponse {
  id: string;
  question: string;
  answer: string;
  group: string | null;
  showOnHome: boolean;
  isPublished: boolean;
  sortOrder: number;
}

export const MAX_HOME_FAQS = 6;

@Injectable()
export class FaqsService extends ContentService<Faq, FaqResponse, CreateFaqDto, UpdateFaqDto, FaqData> {
  constructor(
    private readonly faqs: FaqsRepository,
    revalidation: RevalidationService,
  ) {
    super(faqs, revalidation, 'FAQ');
  }

  protected present({ id, question, answer, group, showOnHome, isPublished, sortOrder }: Faq): FaqResponse {
    return { id, question, answer, group, showOnHome, isPublished, sortOrder };
  }

  protected async toData(dto: CreateFaqDto | UpdateFaqDto): Promise<Partial<FaqData>> {
    return {
      question: dto.question ?? undefined,
      answer: dto.answer ?? undefined,
      group: dto.group,
      showOnHome: dto.showOnHome ?? undefined,
      isPublished: dto.isPublished ?? undefined,
      sortOrder: dto.sortOrder ?? undefined,
    };
  }

  protected revalidationTags(): string[] {
    return ['faqs'];
  }

  protected async validateCreate(dto: CreateFaqDto): Promise<void> {
    if (dto.showOnHome) {
      await this.assertRoomOnHome();
    }
  }

  protected async validateUpdate(current: Faq, dto: UpdateFaqDto): Promise<void> {
    if (dto.showOnHome && !current.showOnHome) {
      await this.assertRoomOnHome(current.id);
    }
  }

  private async assertRoomOnHome(excludeId?: string): Promise<void> {
    if ((await this.faqs.countShownOnHome(excludeId)) >= MAX_HOME_FAQS) {
      throw new ConflictException(`At most ${MAX_HOME_FAQS} FAQs can be shown on the home page`);
    }
  }
}
