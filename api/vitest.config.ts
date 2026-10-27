import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/test',
      JWT_SECRET: 'a-test-secret-that-is-at-least-32-chars',
      INTERNAL_SECRET: 'an-internal-test-secret-of-32-chars-min',
      MAIL_FROM: 'ZoyCoders <no-reply@zoycoders.test>',
    },
  },
});
