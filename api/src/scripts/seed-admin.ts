import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { AdminRepository } from '../modules/auth/admin.repository.js';
import { PasswordHasher } from '../modules/auth/security/password-hasher.js';

const MIN_PASSWORD_LENGTH = 10;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

try {
  const email = required('ADMIN_SEED_EMAIL').trim().toLowerCase();
  const password = required('ADMIN_SEED_PASSWORD');
  const name = process.env.ADMIN_SEED_NAME ?? 'Admin';

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_SEED_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const admins = app.get(AdminRepository, { strict: false });
  const hasher = app.get(PasswordHasher, { strict: false });

  if (await admins.findByEmail(email)) {
    console.log(`Admin ${email} already exists, nothing to do`);
  } else {
    await admins.create({ name, email, passwordHash: await hasher.hash(password) });
    console.log(`Admin ${email} created`);
  }
} finally {
  await app.close();
}
