import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { AdminRepository } from '../src/modules/auth/admin.repository.js';
import { SessionRepository } from '../src/modules/auth/session.repository.js';
import { InMemoryAdminRepository, InMemorySessionRepository } from './support/in-memory-auth.js';

const INTERNAL_SECRET = 'an-internal-test-secret-of-32-chars-min';

describe('rate limiting', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const admins = new InMemoryAdminRepository();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isReachable: async () => true })
      .overrideProvider(AdminRepository)
      .useValue(admins)
      .overrideProvider(SessionRepository)
      .useValue(new InMemorySessionRepository(admins))
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterEach(() => app.close());

  const login = (email: string) => request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'x' });

  it('blocks the sixth login attempt for the same email with a contract error', async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await login('target@zoycoders.com').expect(401);
    }

    const blocked = await login('target@zoycoders.com').expect(429);

    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts each email separately', async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await login('first@zoycoders.com').expect(401);
    }

    await login('second@zoycoders.com').expect(401);
  });

  it('treats the same email in a different case as one bucket', async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await login(attempt % 2 ? 'Mixed@Zoycoders.com' : 'mixed@zoycoders.com').expect(401);
    }

    await login('MIXED@zoycoders.com').expect(429);
  });

  it('reports the limit in RateLimit headers', async () => {
    const response = await login('headers@zoycoders.com').expect(401);

    expect(response.headers['ratelimit-limit']).toBe('5');
    expect(response.headers['ratelimit-remaining']).toBe('4');
    expect(response.headers['ratelimit-reset']).toBeDefined();
  });

  it('uses the public limit for other routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.headers['ratelimit-limit']).toBe('300');
  });

  it('does not limit server-to-server calls that carry the internal secret', async () => {
    for (let attempt = 1; attempt <= 8; attempt++) {
      await login('internal@zoycoders.com').set('x-internal-secret', INTERNAL_SECRET).expect(401);
    }
  });

  it('still limits a wrong internal secret', async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await login('wrong@zoycoders.com').set('x-internal-secret', 'not-the-secret').expect(401);
    }

    await login('wrong@zoycoders.com').set('x-internal-secret', 'not-the-secret').expect(429);
  });
});
