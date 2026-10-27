import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AuthorsController } from './authors.controller.js';
import { AuthorsRepository } from './authors.repository.js';
import { AuthorsService } from './authors.service.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesRepository } from './categories.repository.js';
import { CategoriesService } from './categories.service.js';
import { TagsController } from './tags.controller.js';
import { TagsRepository } from './tags.repository.js';
import { TagsService } from './tags.service.js';
import { TaxonomyPresenter } from './taxonomy.presenter.js';

@Module({
  imports: [MediaModule],
  controllers: [CategoriesController, TagsController, AuthorsController],
  providers: [
    TaxonomyPresenter,
    CategoriesRepository,
    CategoriesService,
    TagsRepository,
    TagsService,
    AuthorsRepository,
    AuthorsService,
  ],
  exports: [TaxonomyPresenter],
})
export class TaxonomyModule {}
