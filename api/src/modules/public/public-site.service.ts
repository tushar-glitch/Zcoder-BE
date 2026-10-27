import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import type { PageRequest } from '../../common/pagination/paginated.js';
import { DEFAULT_HERO } from './default-hero.js';
import type { PublicProjectListQueryDto } from './dto/public-query.dto.js';
import {
  ProjectSummary,
  PublicFaq,
  PublicHero,
  PublicPresenter,
  PublicProject,
  PublicService,
  PublicTestimonial,
} from './public.presenter.js';
import { PublicRepository, SitemapEntries } from './public.repository.js';

const FEATURED_LIMIT = 6;
const TESTIMONIAL_LIMIT = 6;

@Injectable()
export class PublicSiteService {
  constructor(
    private readonly repository: PublicRepository,
    private readonly presenter: PublicPresenter,
  ) {}

  async hero(): Promise<PublicHero> {
    const hero = await this.repository.findPublishedHero();
    return hero ? this.presenter.hero(hero) : DEFAULT_HERO;
  }

  async services(): Promise<PublicService[]> {
    return (await this.repository.findPublishedServices()).map((service) => this.presenter.service(service));
  }

  async service(slug: string): Promise<PublicService> {
    const service = await this.repository.findPublishedService(slug);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return this.presenter.service(service);
  }

  async projects({ featured, technology, page, pageSize }: PublicProjectListQueryDto): Promise<Paginated<ProjectSummary>> {
    const request: PageRequest = { page, pageSize: featured ? Math.min(pageSize, FEATURED_LIMIT) : pageSize };
    const { items, total } = await this.repository.findPublishedProjects({ featured, technology }, request);
    return Paginated.of(items, total, request).map((project) => this.presenter.projectSummary(project));
  }

  async project(slug: string): Promise<PublicProject> {
    const project = await this.repository.findPublishedProject(slug);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.presenter.project(project);
  }

  async testimonials(): Promise<PublicTestimonial[]> {
    return (await this.repository.findPublishedTestimonials(TESTIMONIAL_LIMIT)).map((row) => this.presenter.testimonial(row));
  }

  async faqs(homeOnly: boolean): Promise<PublicFaq[]> {
    return (await this.repository.findPublishedFaqs(homeOnly)).map((faq) => this.presenter.faq(faq));
  }

  sitemap(): Promise<SitemapEntries> {
    return this.repository.findSitemapEntries();
  }
}
