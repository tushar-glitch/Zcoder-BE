import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { resolve } from 'node:path';
import type { Environment } from './config/environment.js';

export const API_PREFIX = 'api/v1';
export const UPLOADS_ROUTE = '/uploads';
const JSON_BODY_LIMIT = '1mb';

export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  app.setGlobalPrefix(API_PREFIX);
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(cookieParser());
  app.useStaticAssets(resolve(config.get('UPLOAD_DIR', { infer: true })), {
    prefix: UPLOADS_ROUTE,
    maxAge: '365d',
    immutable: true,
  });
}
