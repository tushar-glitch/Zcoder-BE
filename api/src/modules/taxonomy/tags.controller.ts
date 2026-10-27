import { Controller } from '@nestjs/common';
import { AuditEntity } from '../audit/audit.decorator.js';
import { TagsService } from './tags.service.js';
import { TaxonomyController } from './taxonomy.controller.js';

@Controller('admin/tags')
@AuditEntity('tag')
export class TagsController extends TaxonomyController {
  constructor(service: TagsService) {
    super(service);
  }
}
