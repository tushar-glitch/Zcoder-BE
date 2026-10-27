import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { TaxonomyModule } from '../taxonomy/taxonomy.module.js';
import { BlogPresenter } from './blog.presenter.js';
import { BlogSlugService } from './blog-slug.service.js';
import { BlogsController } from './blogs.controller.js';
import { BlogsRepository } from './blogs.repository.js';
import { BlogsService } from './blogs.service.js';
import { ContentRenderer } from './content/content-renderer.js';

@Module({
  imports: [MediaModule, TaxonomyModule],
  controllers: [BlogsController],
  providers: [BlogsService, BlogsRepository, BlogPresenter, BlogSlugService, ContentRenderer],
  exports: [BlogsRepository, BlogPresenter],
})
export class BlogsModule {}
