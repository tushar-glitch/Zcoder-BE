import { Controller, Get, Param, Query } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { PublicFaqQueryDto, PublicProjectListQueryDto } from './dto/public-query.dto.js';
import type { ProjectSummary, PublicFaq, PublicHero, PublicProject, PublicService, PublicTestimonial } from './public.presenter.js';
import type { SitemapEntries } from './public.repository.js';
import { PublicSiteService } from './public-site.service.js';

@Public()
@Controller('public')
export class PublicSiteController {
  constructor(private readonly site: PublicSiteService) {}

  @Get('hero')
  hero(): Promise<PublicHero> {
    return this.site.hero();
  }

  @Get('services')
  services(): Promise<PublicService[]> {
    return this.site.services();
  }

  @Get('services/:slug')
  service(@Param('slug') slug: string): Promise<PublicService> {
    return this.site.service(slug);
  }

  @Get('projects')
  projects(@Query() query: PublicProjectListQueryDto): Promise<Paginated<ProjectSummary>> {
    return this.site.projects(query);
  }

  @Get('projects/:slug')
  project(@Param('slug') slug: string): Promise<PublicProject> {
    return this.site.project(slug);
  }

  @Get('testimonials')
  testimonials(): Promise<PublicTestimonial[]> {
    return this.site.testimonials();
  }

  @Get('faqs')
  faqs(@Query() { home }: PublicFaqQueryDto): Promise<PublicFaq[]> {
    return this.site.faqs(home === true);
  }

  @Get('sitemap-entries')
  sitemap(): Promise<SitemapEntries> {
    return this.site.sitemap();
  }
}
