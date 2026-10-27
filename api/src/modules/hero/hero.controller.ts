import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { UuidParam } from '../../common/pipes/uuid-param.js';
import { Audit, AuditEntity } from '../audit/audit.decorator.js';
import { CreateHeroDto, UpdateHeroDto } from './dto/hero.dto.js';
import { HeroResponse, HeroService } from './hero.service.js';

@Controller('admin/hero')
@AuditEntity('hero')
export class HeroController {
  constructor(private readonly heroService: HeroService) {}

  @Get()
  list(): Promise<HeroResponse[]> {
    return this.heroService.list();
  }

  @Post()
  @Audit('create')
  create(@Body() dto: CreateHeroDto): Promise<HeroResponse> {
    return this.heroService.create(dto);
  }

  @Get(':id')
  get(@UuidParam() id: string): Promise<HeroResponse> {
    return this.heroService.get(id);
  }

  @Patch(':id')
  @Audit('update')
  update(@UuidParam() id: string, @Body() dto: UpdateHeroDto): Promise<HeroResponse> {
    return this.heroService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.heroService.delete(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Audit('publish')
  publish(@UuidParam() id: string): Promise<HeroResponse> {
    return this.heroService.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @Audit('unpublish')
  unpublish(@UuidParam() id: string): Promise<HeroResponse> {
    return this.heroService.unpublish(id);
  }
}
