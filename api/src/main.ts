import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const API_PREFIX = 'api/v1';
const DEFAULT_PORT = 4000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  await app.listen(process.env.PORT ?? DEFAULT_PORT);
}

await bootstrap();
