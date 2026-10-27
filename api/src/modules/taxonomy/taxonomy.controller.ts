import { Body, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { UuidParam } from '../../common/pipes/uuid-param.js';
import { Audit } from '../audit/audit.decorator.js';
import { CreateTaxonomyDto, UpdateTaxonomyDto } from './dto/taxonomy.dto.js';
import type { TaxonomyWithCountResponse } from './taxonomy.presenter.js';
import { TaxonomyService } from './taxonomy.service.js';

export abstract class TaxonomyController {
  protected constructor(private readonly service: TaxonomyService) {}

  @Get()
  list(): Promise<TaxonomyWithCountResponse[]> {
    return this.service.list();
  }

  @Post()
  @Audit('create')
  create(@Body() dto: CreateTaxonomyDto): Promise<TaxonomyWithCountResponse> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Audit('update')
  update(@UuidParam() id: string, @Body() dto: UpdateTaxonomyDto): Promise<TaxonomyWithCountResponse> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.service.delete(id);
  }
}
