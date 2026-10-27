import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';

describe('GET /api/v1/health', () => {
  let app: NestExpressApplication;

  async function start(databaseReachable: boolean): Promise<void> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isReachable: async () => databaseReachable })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  }

  afterEach(() => app.close());

  it('reports ok inside the data envelope', async () => {
    await start(true);

    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body.data).toMatchObject({ status: 'ok', db: 'up' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns 503 with a generic error when the database is down', async () => {
    await start(false);

    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);

    expect(response.body.error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
  });

  it('returns the error envelope for unknown routes', async () => {
    await start(true);

    const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
