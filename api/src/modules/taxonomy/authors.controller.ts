import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { UuidParam } from '../../common/pipes/uuid-param.js';
import { Audit, AuditEntity } from '../audit/audit.decorator.js';
import { AuthorsService } from './authors.service.js';
import { CreateAuthorDto, UpdateAuthorDto } from './dto/author.dto.js';
import type { AuthorResponse } from './taxonomy.presenter.js';

@Controller('admin/authors')
@AuditEntity('author')
export class AuthorsController {
  constructor(private readonly service: AuthorsService) {}

  @Get()
  list(): Promise<AuthorResponse[]> {
    return this.service.list();
  }

  @Post()
  @Audit('create')
  create(@Body() dto: CreateAuthorDto): Promise<AuthorResponse> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Audit('update')
  update(@UuidParam() id: string, @Body() dto: UpdateAuthorDto): Promise<AuthorResponse> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.service.delete(id);
  }
}
