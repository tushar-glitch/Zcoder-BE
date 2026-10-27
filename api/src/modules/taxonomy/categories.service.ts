import { Injectable } from '@nestjs/common';
import { RevalidationService } from '../../infrastructure/revalidation/revalidation.service.js';
import { CategoriesRepository } from './categories.repository.js';
import { TaxonomyPresenter } from './taxonomy.presenter.js';
import { TaxonomyService } from './taxonomy.service.js';

@Injectable()
export class CategoriesService extends TaxonomyService {
  constructor(repository: CategoriesRepository, presenter: TaxonomyPresenter, revalidation: RevalidationService) {
    super(repository, presenter, revalidation, 'Category');
  }
}
