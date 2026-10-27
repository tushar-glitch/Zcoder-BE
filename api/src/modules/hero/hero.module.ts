import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { HeroController } from './hero.controller.js';
import { HeroRepository } from './hero.repository.js';
import { HeroService } from './hero.service.js';

@Module({
  imports: [MediaModule],
  controllers: [HeroController],
  providers: [HeroService, HeroRepository],
  exports: [HeroRepository],
})
export class HeroModule {}
