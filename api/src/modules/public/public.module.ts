import { Module } from '@nestjs/common';
import { BlogsModule } from '../blogs/blogs.module.js';
import { MediaModule } from '../media/media.module.js';
import { TaxonomyModule } from '../taxonomy/taxonomy.module.js';
import { PublicBlogsController } from './public-blogs.controller.js';
import { PublicBlogsService } from './public-blogs.service.js';
import { PublicSiteController } from './public-site.controller.js';
import { PublicSiteService } from './public-site.service.js';
import { PublicPresenter } from './public.presenter.js';
import { PublicRepository } from './public.repository.js';

@Module({
  imports: [MediaModule, TaxonomyModule, BlogsModule],
  controllers: [PublicSiteController, PublicBlogsController],
  providers: [PublicSiteService, PublicBlogsService, PublicPresenter, PublicRepository],
})
export class PublicModule {}
