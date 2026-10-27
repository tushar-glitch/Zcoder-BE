import { Controller } from '@nestjs/common';
import { AuditEntity } from '../audit/audit.decorator.js';
import { CategoriesService } from './categories.service.js';
import { TaxonomyController } from './taxonomy.controller.js';

@Controller('admin/categories')
@AuditEntity('category')
export class CategoriesController extends TaxonomyController {
  constructor(service: CategoriesService) {
    super(service);
  }
}
