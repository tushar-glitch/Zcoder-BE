import { Injectable } from '@nestjs/common';
import { RevalidationService } from '../../infrastructure/revalidation/revalidation.service.js';
import { TagsRepository } from './tags.repository.js';
import { TaxonomyPresenter } from './taxonomy.presenter.js';
import { TaxonomyService } from './taxonomy.service.js';

@Injectable()
export class TagsService extends TaxonomyService {
  constructor(repository: TagsRepository, presenter: TaxonomyPresenter, revalidation: RevalidationService) {
    super(repository, presenter, revalidation, 'Tag');
  }
}
