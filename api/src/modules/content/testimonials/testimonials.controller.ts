import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { UuidParam } from '../../../common/pipes/uuid-param.js';
import { Audit, AuditEntity } from '../../audit/audit.decorator.js';
import { CreateTestimonialDto, UpdateTestimonialDto } from './dto/testimonial.dto.js';
import { TestimonialResponse, TestimonialsService } from './testimonials.service.js';

@Controller('admin/testimonials')
@AuditEntity('testimonial')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  list(): Promise<TestimonialResponse[]> {
    return this.testimonialsService.list();
  }

  @Post()
  @Audit('create')
  create(@Body() dto: CreateTestimonialDto): Promise<TestimonialResponse> {
    return this.testimonialsService.create(dto);
  }

  @Get(':id')
  get(@UuidParam() id: string): Promise<TestimonialResponse> {
    return this.testimonialsService.get(id);
  }

  @Patch(':id')
  @Audit('update')
  update(@UuidParam() id: string, @Body() dto: UpdateTestimonialDto): Promise<TestimonialResponse> {
    return this.testimonialsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.testimonialsService.delete(id);
  }
}
