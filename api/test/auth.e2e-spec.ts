import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AppThrottlerGuard } from '../src/common/rate-limit/app-throttler.guard.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { AdminRepository } from '../src/modules/auth/admin.repository.js';
import { ScryptPasswordHasher } from '../src/modules/auth/security/scrypt-password-hasher.js';
import { SessionRepository } from '../src/modules/auth/session.repository.js';
import { InMemoryAdminRepository, InMemorySessionRepository } from './support/in-memory-auth.js';

const ORIGIN = 'http://localhost:3000';
const EMAIL = 'admin@zoycoders.com';
const PASSWORD = 'correct-password-1';

describe('auth', () => {
  let app: NestExpressApplication;
  let admins: InMemoryAdminRepository;
  let sessions: InMemorySessionRepository;

  beforeEach(async () => {
    admins = new InMemoryAdminRepository();
    sessions = new InMemorySessionRepository(admins);
    await admins.create({
      name: 'Zoy Admin',
      email: EMAIL,
      passwordHash: await new ScryptPasswordHasher().hash(PASSWORD),
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AppThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(PrismaService)
      .useValue({ isReachable: async () => true })
      .overrideProvider(AdminRepository)
      .useValue(admins)
      .overrideProvider(SessionRepository)
      .useValue(sessions)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterEach(() => app.close());

  const server = () => app.getHttpServer();
  const login = (password = PASSWORD, email = EMAIL) => request(server()).post('/api/v1/auth/login').send({ email, password });
  const cookiesOf = (response: Response): string[] => response.headers['set-cookie'] as unknown as string[];
  const cookieHeader = (response: Response): string => cookiesOf(response).map((c) => c.split(';')[0]).join('; ');
  const cookieValue = (response: Response, name: string): string =>
    cookiesOf(response).find((c) => c.startsWith(`${name}=`))!.split(';')[0].slice(name.length + 1);

  describe('login', () => {
    it('signs in and sets httpOnly session cookies', async () => {
      const response = await login().expect(200);

      expect(response.body.data).toMatchObject({ email: EMAIL, name: 'Zoy Admin', role: 'ADMIN' });
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      const [access, refresh] = cookiesOf(response);
      expect(access).toMatch(/^zc_access=.*Path=\/;.*HttpOnly.*SameSite=Lax/);
      expect(refresh).toMatch(/^zc_refresh=.*Path=\/api\/v1\/auth;.*HttpOnly.*SameSite=Lax/);
    });

    it('gives the same generic error for a wrong password and an unknown email', async () => {
      const wrongPassword = await login('wrong-password').expect(401);
      const unknownEmail = await login(PASSWORD, 'nobody@zoycoders.com').expect(401);

      expect(wrongPassword.body.error.message).toBe('Invalid email or password');
      expect(unknownEmail.body.error.message).toBe('Invalid email or password');
    });

    it('rejects an inactive admin', async () => {
      [...admins.admins.values()][0].isActive = false;

      await login().expect(401);
    });

    it('locks the account on the fifth failure and rejects even the right password', async () => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        await login('wrong-password').expect(401);
      }

      const fifth = await login('wrong-password').expect(423);
      expect(fifth.body.error).toMatchObject({ code: 'ACCOUNT_LOCKED' });
      expect(fifth.body.error.retryAfterSeconds).toBeGreaterThan(890);

      await login().expect(423);
    });

    it('reports every invalid field', async () => {
      const response = await login('', 'not-an-email').expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'password']);
    });
  });

  describe('protected routes', () => {
    it('rejects a request without a session', async () => {
      const response = await request(server()).get('/api/v1/auth/me').expect(401);

      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns the current admin for a valid session', async () => {
      const agent = request.agent(server());
      await agent.post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);

      const response = await agent.get('/api/v1/auth/me').expect(200);

      expect(response.body.data.email).toBe(EMAIL);
    });

    it('rejects a forged access token', async () => {
      await request(server()).get('/api/v1/auth/me').set('Cookie', 'zc_access=not.a.jwt').expect(401);
    });

    it('keeps the health endpoint public', async () => {
      await request(server()).get('/api/v1/health').expect((res) => expect(res.status).not.toBe(401));
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and keeps the session usable', async () => {
      const first = await login().expect(200);

      const refreshed = await request(server())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookieHeader(first))
        .set('Origin', ORIGIN)
        .expect(200);

      expect(cookieValue(refreshed, 'zc_refresh')).not.toBe(cookieValue(first, 'zc_refresh'));
      await request(server()).get('/api/v1/auth/me').set('Cookie', cookieHeader(refreshed)).expect(200);
    });

    it('revokes the whole session when an old refresh token is replayed', async () => {
      const first = await login().expect(200);
      const refreshed = await request(server())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookieHeader(first))
        .set('Origin', ORIGIN)
        .expect(200);

      await request(server())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookieHeader(first))
        .set('Origin', ORIGIN)
        .expect(401);

      await request(server()).get('/api/v1/auth/me').set('Cookie', cookieHeader(refreshed)).expect(401);
    });

    it('rejects a missing refresh cookie', async () => {
      await request(server()).post('/api/v1/auth/refresh').expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the session and clears the cookies', async () => {
      const signedIn = await login().expect(200);

      const response = await request(server())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookieHeader(signedIn))
        .set('Origin', ORIGIN)
        .expect(204);

      expect(cookiesOf(response).every((cookie) => /Expires=Thu, 01 Jan 1970/.test(cookie))).toBe(true);
      await request(server()).get('/api/v1/auth/me').set('Cookie', cookieHeader(signedIn)).expect(401);
    });

    it('still works when only the refresh cookie is left', async () => {
      const signedIn = await login().expect(200);

      await request(server())
        .post('/api/v1/auth/logout')
        .set('Cookie', `zc_refresh=${cookieValue(signedIn, 'zc_refresh')}`)
        .set('Origin', ORIGIN)
        .expect(204);

      await request(server()).get('/api/v1/auth/me').set('Cookie', cookieHeader(signedIn)).expect(401);
    });
  });

  describe('change password', () => {
    const change = (response: Response, body: object, origin = ORIGIN) =>
      request(server())
        .post('/api/v1/auth/change-password')
        .set('Cookie', cookieHeader(response))
        .set('Origin', origin)
        .send(body);

    it('rejects a wrong current password', async () => {
      const signedIn = await login().expect(200);

      const response = await change(signedIn, { currentPassword: 'nope', newPassword: 'a-brand-new-password' }).expect(400);

      expect(response.body.error.details).toEqual([
        { path: 'currentPassword', message: 'Current password is incorrect' },
      ]);
    });

    it('rejects a short new password', async () => {
      const signedIn = await login().expect(200);

      await change(signedIn, { currentPassword: PASSWORD, newPassword: 'short' }).expect(400);
    });

    it('changes the password and revokes every other session', async () => {
      const current = await login().expect(200);
      const other = await login().expect(200);

      await change(current, { currentPassword: PASSWORD, newPassword: 'a-brand-new-password' }).expect(204);

      await request(server()).get('/api/v1/auth/me').set('Cookie', cookieHeader(current)).expect(200);
      await request(server()).get('/api/v1/auth/me').set('Cookie', cookieHeader(other)).expect(401);
      await login(PASSWORD).expect(401);
      await login('a-brand-new-password').expect(200);
    });
  });

  describe('origin check', () => {
    it('rejects a state-changing request from another origin', async () => {
      const signedIn = await login().expect(200);

      const response = await request(server())
        .post('/api/v1/auth/change-password')
        .set('Cookie', cookieHeader(signedIn))
        .set('Origin', 'https://evil.example')
        .send({ currentPassword: PASSWORD, newPassword: 'a-brand-new-password' })
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects a cookie-carrying request with no Origin or Referer', async () => {
      const signedIn = await login().expect(200);

      await request(server()).post('/api/v1/auth/logout').set('Cookie', cookieHeader(signedIn)).expect(403);
    });

    it('accepts the Referer when Origin is absent', async () => {
      const signedIn = await login().expect(200);

      await request(server())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookieHeader(signedIn))
        .set('Referer', `${ORIGIN}/admin`)
        .expect(204);
    });
  });
});
