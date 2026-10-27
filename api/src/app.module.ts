import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
})
export class AppModule {}
