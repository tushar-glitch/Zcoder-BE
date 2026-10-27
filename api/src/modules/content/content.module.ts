import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { FaqsController } from './faqs/faqs.controller.js';
import { FaqsRepository } from './faqs/faqs.repository.js';
import { FaqsService } from './faqs/faqs.service.js';
import { ProjectsController } from './projects/projects.controller.js';
import { ProjectsRepository } from './projects/projects.repository.js';
import { ProjectsService } from './projects/projects.service.js';
import { ServicesController } from './services/services.controller.js';
import { ServicesRepository } from './services/services.repository.js';
import { ServicesService } from './services/services.service.js';
import { TestimonialsController } from './testimonials/testimonials.controller.js';
import { TestimonialsRepository } from './testimonials/testimonials.repository.js';
import { TestimonialsService } from './testimonials/testimonials.service.js';

@Module({
  imports: [MediaModule],
  controllers: [ServicesController, ProjectsController, TestimonialsController, FaqsController],
  providers: [
    ServicesRepository,
    ServicesService,
    ProjectsRepository,
    ProjectsService,
    TestimonialsRepository,
    TestimonialsService,
    FaqsRepository,
    FaqsService,
  ],
  exports: [ServicesRepository, ProjectsRepository, TestimonialsRepository, FaqsRepository],
})
export class ContentModule {}
