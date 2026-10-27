import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { MailSender } from '../src/infrastructure/mail/mail-sender.js';
import { AdminRepository } from '../src/modules/auth/admin.repository.js';
import { PasswordResetRepository } from '../src/modules/auth/password-reset.repository.js';
import { ScryptPasswordHasher } from '../src/modules/auth/security/scrypt-password-hasher.js';
import { SessionRepository } from '../src/modules/auth/session.repository.js';
import {
  CapturingMailSender,
  InMemoryAdminRepository,
  InMemoryPasswordResetRepository,
  InMemorySessionRepository,
} from './support/in-memory-auth.js';

const EMAIL = 'admin@zoycoders.com';
const OLD_PASSWORD = 'old-password-123';
const NEW_PASSWORD = 'a-brand-new-password';

describe('password reset', () => {
  let app: NestExpressApplication;
  let admins: InMemoryAdminRepository;
  let resets: InMemoryPasswordResetRepository;
  let mail: CapturingMailSender;

  beforeEach(async () => {
    admins = new InMemoryAdminRepository();
    resets = new InMemoryPasswordResetRepository(admins);
    mail = new CapturingMailSender();
    await admins.create({
      name: 'Zoy Admin',
      email: EMAIL,
      passwordHash: await new ScryptPasswordHasher().hash(OLD_PASSWORD),
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isReachable: async () => true })
      .overrideProvider(AdminRepository)
      .useValue(admins)
      .overrideProvider(SessionRepository)
      .useValue(new InMemorySessionRepository(admins))
      .overrideProvider(PasswordResetRepository)
      .useValue(resets)
      .overrideProvider(MailSender)
      .useValue(mail)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterEach(() => app.close());

  const server = () => app.getHttpServer();
  const forgot = (email = EMAIL) => request(server()).post('/api/v1/auth/forgot-password').send({ email });
  const reset = (token: string, newPassword = NEW_PASSWORD) =>
    request(server()).post('/api/v1/auth/reset-password').send({ token, newPassword });
  const login = (password: string) => request(server()).post('/api/v1/auth/login').send({ email: EMAIL, password });

  async function requestToken(): Promise<string> {
    const delivered = mail.sent.length + 1;
    await forgot().expect(204);
    await vi.waitFor(() => expect(mail.sent).toHaveLength(delivered));
    return new URL(mail.sent.at(-1)!.text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;
  }

  it('emails a one-time link to a known admin', async () => {
    await requestToken();

    expect(mail.sent[0].to).toBe(EMAIL);
    expect(mail.sent[0].text).toContain('http://localhost:3000/admin/reset-password?token=');
  });

  it('answers 204 for an unknown email and sends nothing', async () => {
    await forgot('nobody@zoycoders.com').expect(204);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mail.sent).toHaveLength(0);
  });

  it('sends nothing to a deactivated admin', async () => {
    [...admins.admins.values()][0].isActive = false;

    await forgot().expect(204);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mail.sent).toHaveLength(0);
  });

  it('sets a new password with the emailed token', async () => {
    const token = await requestToken();

    await reset(token).expect(204);

    await login(OLD_PASSWORD).expect(401);
    await login(NEW_PASSWORD).expect(200);
  });

  it('works only once', async () => {
    const token = await requestToken();
    await reset(token).expect(204);

    const second = await reset(token, 'yet-another-password').expect(400);

    expect(second.body.error.details).toEqual([{ path: 'token', message: 'Invalid or expired token' }]);
  });

  it('invalidates the earlier link when a new one is requested', async () => {
    const first = await requestToken();
    const second = await requestToken();

    await reset(first).expect(400);
    await reset(second).expect(204);
  });

  it('rejects an expired token', async () => {
    const token = await requestToken();
    resets.tokens[0].expiresAt = new Date(Date.now() - 1000);

    await reset(token).expect(400);
  });

  it('rejects an unknown token and a short password', async () => {
    await reset('made-up-token').expect(400);
    await reset(await requestToken(), 'short').expect(400);
  });

  it('signs out every session and clears a login lock', async () => {
    const signedIn = await login(OLD_PASSWORD).expect(200);
    const admin = [...admins.admins.values()][0];
    admin.failedLoginAttempts = 5;
    admin.lockedUntil = new Date(Date.now() + 600_000);

    await reset(await requestToken()).expect(204);

    await request(server()).get('/api/v1/auth/me').set('Cookie', signedIn.headers['set-cookie']).expect(401);
    expect(admin.lockedUntil).toBeNull();
    await login(NEW_PASSWORD).expect(200);
  });
});
