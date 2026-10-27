import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Environment } from './config/environment.js';

export const API_PREFIX = 'api/v1';

export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  app.setGlobalPrefix(API_PREFIX);
  app.use(cookieParser());
}
