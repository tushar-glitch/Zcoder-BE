import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { AppThrottlerGuard } from '../../src/common/rate-limit/app-throttler.guard.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { MailSender } from '../../src/infrastructure/mail/mail-sender.js';
import { RevalidationService } from '../../src/infrastructure/revalidation/revalidation.service.js';
import { FileStorage } from '../../src/infrastructure/storage/file-storage.js';
import { AuditRepository } from '../../src/modules/audit/audit.repository.js';
import { AdminRepository } from '../../src/modules/auth/admin.repository.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/security/scrypt-password-hasher.js';
import { SessionRepository } from '../../src/modules/auth/session.repository.js';
import { BlogsRepository } from '../../src/modules/blogs/blogs.repository.js';
import { FaqsRepository } from '../../src/modules/content/faqs/faqs.repository.js';
import { ProjectsRepository } from '../../src/modules/content/projects/projects.repository.js';
import { ServicesRepository } from '../../src/modules/content/services/services.repository.js';
import { TestimonialsRepository } from '../../src/modules/content/testimonials/testimonials.repository.js';
import { HeroRepository } from '../../src/modules/hero/hero.repository.js';
import { DashboardRepository } from '../../src/modules/dashboard/dashboard.repository.js';
import { PublicRepository } from '../../src/modules/public/public.repository.js';
import { InquiriesRepository } from '../../src/modules/inquiries/inquiries.repository.js';
import { MediaRepository } from '../../src/modules/media/media.repository.js';
import { AuthorsRepository } from '../../src/modules/taxonomy/authors.repository.js';
import { CategoriesRepository } from '../../src/modules/taxonomy/categories.repository.js';
import { TagsRepository } from '../../src/modules/taxonomy/tags.repository.js';
import { CapturingMailSender, InMemoryAdminRepository, InMemorySessionRepository } from './in-memory-auth.js';
import {
  InMemoryAuthorsRepository,
  InMemoryBlogsRepository,
  InMemoryCatalog,
  createCategoriesRepository,
  createTagsRepository,
} from './in-memory-blogs.js';
import { InMemoryDashboardRepository } from './in-memory-dashboard.js';
import { InMemoryPublicRepository } from './in-memory-public.js';
import { InMemoryInquiriesRepository } from './in-memory-inquiries.js';
import { InMemoryAuditRepository, InMemoryFileStorage, InMemoryMediaRepository } from './in-memory-content.js';
import {
  InMemoryFaqsRepository,
  InMemoryHeroRepository,
  InMemoryProjectsRepository,
  InMemoryServicesRepository,
  InMemoryTestimonialsRepository,
} from './in-memory-site-content.js';

export const ORIGIN = 'http://localhost:3000';
export const ADMIN_EMAIL = 'admin@zoycoders.com';
export const ADMIN_PASSWORD = 'correct-password-1';

export interface AdminClient {
  get(url: string): request.Test;
  post(url: string): request.Test;
  patch(url: string): request.Test;
  delete(url: string): request.Test;
}

export interface TestApp {
  app: NestExpressApplication;
  admins: InMemoryAdminRepository;
  audit: InMemoryAuditRepository;
  mail: CapturingMailSender;
  media: InMemoryMediaRepository;
  storage: InMemoryFileStorage;
  catalog: InMemoryCatalog;
  inquiries: InMemoryInquiriesRepository;
  revalidated: string[][];
  admin: AdminClient;
  anonymous: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<TestApp> {
  const admins = new InMemoryAdminRepository();
  const audit = new InMemoryAuditRepository(admins);
  const mail = new CapturingMailSender();
  const media = new InMemoryMediaRepository();
  const storage = new InMemoryFileStorage();
  const catalog = new InMemoryCatalog(media);
  const revalidated: string[][] = [];
  const inquiries = new InMemoryInquiriesRepository(admins);
  const blogs = new InMemoryBlogsRepository(catalog);
  const services = new InMemoryServicesRepository(media);
  const projects = new InMemoryProjectsRepository(media);
  const testimonials = new InMemoryTestimonialsRepository(media);
  const faqs = new InMemoryFaqsRepository();
  const heroes = new InMemoryHeroRepository(media);
  await admins.create({
    name: 'Zoy Admin',
    email: ADMIN_EMAIL,
    passwordHash: await new ScryptPasswordHasher().hash(ADMIN_PASSWORD),
  });

  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideProvider(PrismaService)
    .useValue({ isReachable: async () => true })
    .overrideProvider(AdminRepository)
    .useValue(admins)
    .overrideProvider(SessionRepository)
    .useValue(new InMemorySessionRepository(admins))
    .overrideProvider(AuditRepository)
    .useValue(audit)
    .overrideProvider(MailSender)
    .useValue(mail)
    .overrideProvider(FileStorage)
    .useValue(storage)
    .overrideProvider(MediaRepository)
    .useValue(media)
    .overrideProvider(CategoriesRepository)
    .useValue(createCategoriesRepository(catalog))
    .overrideProvider(TagsRepository)
    .useValue(createTagsRepository(catalog))
    .overrideProvider(AuthorsRepository)
    .useValue(new InMemoryAuthorsRepository(catalog))
    .overrideProvider(BlogsRepository)
    .useValue(blogs)
    .overrideProvider(ServicesRepository)
    .useValue(services)
    .overrideProvider(ProjectsRepository)
    .useValue(projects)
    .overrideProvider(TestimonialsRepository)
    .useValue(testimonials)
    .overrideProvider(FaqsRepository)
    .useValue(faqs)
    .overrideProvider(HeroRepository)
    .useValue(heroes)
    .overrideProvider(PublicRepository)
    .useValue(new InMemoryPublicRepository(heroes, services, projects, testimonials, faqs, blogs, catalog))
    .overrideProvider(InquiriesRepository)
    .useValue(inquiries)
    .overrideProvider(DashboardRepository)
    .useValue(new InMemoryDashboardRepository(inquiries, catalog))
    .overrideProvider(RevalidationService)
    .useValue({ revalidate: (tags: string[]) => revalidated.push(tags) });

  const moduleRef = await customize(builder).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const server = app.getHttpServer();
  const signedIn = await request(server).post('/api/v1/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const cookie = (signedIn.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
  const authorised = (test: request.Test): request.Test => test.set('Cookie', cookie).set('Origin', ORIGIN);

  return {
    app,
    admins,
    audit,
    mail,
    media,
    storage,
    catalog,
    inquiries,
    revalidated,
    admin: {
      get: (url) => authorised(request(server).get(url)),
      post: (url) => authorised(request(server).post(url)),
      patch: (url) => authorised(request(server).patch(url)),
      delete: (url) => authorised(request(server).delete(url)),
    },
    anonymous: () => request(server),
    close: () => app.close(),
  };
}
