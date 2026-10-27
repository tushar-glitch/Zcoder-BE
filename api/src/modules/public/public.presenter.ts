import { Injectable } from '@nestjs/common';
import type { Faq } from '../../generated/prisma/client.js';
import type { ProjectRow } from '../content/projects/projects.repository.js';
import type { ServiceRow } from '../content/services/services.repository.js';
import type { TestimonialRow } from '../content/testimonials/testimonials.repository.js';
import type { CtaLink } from '../hero/hero.service.js';
import { toCta } from '../hero/hero.service.js';
import type { HeroRow } from '../hero/hero.repository.js';
import { MediaPresenter } from '../media/media.presenter.js';
import type { MediaRef } from '../media/media.presenter.js';

export interface PublicHero {
  isDefault: boolean;
  heading: string;
  subheading: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink | null;
  image: MediaRef | null;
}

export interface PublicService {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
  shortDescription: string | null;
  description: string | null;
  technologies: string[];
  seoTitle: string;
  seoDescription: string;
  ogImage: MediaRef | null;
}

export interface ProjectSummary {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  technologies: string[];
  coverImage: MediaRef | null;
  isFeatured: boolean;
}

export interface PublicProject extends ProjectSummary {
  description: string | null;
  gallery: { image: MediaRef; sortOrder: number }[];
  demoUrl: string | null;
  seoTitle: string;
  seoDescription: string;
  ogImage: MediaRef | null;
  publishedAt: Date | null;
}

export interface PublicTestimonial {
  id: string;
  clientName: string;
  clientRole: string | null;
  company: string | null;
  quote: string;
  avatar: MediaRef | null;
  rating: number | null;
}

export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
  group: string | null;
}

@Injectable()
export class PublicPresenter {
  constructor(private readonly media: MediaPresenter) {}

  hero(hero: HeroRow): PublicHero {
    return {
      isDefault: false,
      heading: hero.heading ?? '',
      subheading: hero.subheading ?? '',
      primaryCta: toCta(hero.primaryCtaLabel, hero.primaryCtaUrl) ?? { label: '', url: '/' },
      secondaryCta: toCta(hero.secondaryCtaLabel, hero.secondaryCtaUrl),
      image: this.media.refOrNull(hero.image),
    };
  }

  service(service: ServiceRow): PublicService {
    return {
      id: service.id,
      title: service.title,
      slug: service.slug,
      icon: service.icon,
      shortDescription: service.shortDescription,
      description: service.description,
      technologies: service.technologies,
      seoTitle: service.seoTitle || service.title,
      seoDescription: service.seoDescription || service.shortDescription || '',
      ogImage: this.media.refOrNull(service.ogImage),
    };
  }

  projectSummary(project: ProjectRow): ProjectSummary {
    return {
      id: project.id,
      title: project.title,
      slug: project.slug,
      summary: project.summary,
      technologies: project.technologies,
      coverImage: this.media.refOrNull(project.coverImage),
      isFeatured: project.isFeatured,
    };
  }

  project(project: ProjectRow): PublicProject {
    return {
      ...this.projectSummary(project),
      description: project.description,
      gallery: project.gallery.map(({ media, sortOrder }) => ({ image: this.media.ref(media), sortOrder })),
      demoUrl: project.demoUrl,
      seoTitle: project.seoTitle || project.title,
      seoDescription: project.seoDescription || project.summary || '',
      ogImage: this.media.refOrNull(project.ogImage ?? project.coverImage),
      publishedAt: project.publishedAt,
    };
  }

  testimonial(testimonial: TestimonialRow): PublicTestimonial {
    return {
      id: testimonial.id,
      clientName: testimonial.clientName,
      clientRole: testimonial.clientRole,
      company: testimonial.company,
      quote: testimonial.quote,
      avatar: this.media.refOrNull(testimonial.avatar),
      rating: testimonial.rating,
    };
  }

  faq({ id, question, answer, group }: Faq): PublicFaq {
    return { id, question, answer, group };
  }
}
