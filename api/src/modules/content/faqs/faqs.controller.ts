import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { UuidParam } from '../../../common/pipes/uuid-param.js';
import { Audit, AuditEntity } from '../../audit/audit.decorator.js';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto.js';
import { FaqResponse, FaqsService } from './faqs.service.js';

@Controller('admin/faqs')
@AuditEntity('faq')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Get()
  list(): Promise<FaqResponse[]> {
    return this.faqsService.list();
  }

  @Post()
  @Audit('create')
  create(@Body() dto: CreateFaqDto): Promise<FaqResponse> {
    return this.faqsService.create(dto);
  }

  @Get(':id')
  get(@UuidParam() id: string): Promise<FaqResponse> {
    return this.faqsService.get(id);
  }

  @Patch(':id')
  @Audit('update')
  update(@UuidParam() id: string, @Body() dto: UpdateFaqDto): Promise<FaqResponse> {
    return this.faqsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.faqsService.delete(id);
  }
}
