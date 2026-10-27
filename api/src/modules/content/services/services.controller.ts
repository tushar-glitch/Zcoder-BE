import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { UuidParam } from '../../../common/pipes/uuid-param.js';
import { Audit, AuditEntity } from '../../audit/audit.decorator.js';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto.js';
import { ServiceResponse, ServicesService } from './services.service.js';

@Controller('admin/services')
@AuditEntity('service')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  list(): Promise<ServiceResponse[]> {
    return this.servicesService.list();
  }

  @Post()
  @Audit('create')
  create(@Body() dto: CreateServiceDto): Promise<ServiceResponse> {
    return this.servicesService.create(dto);
  }

  @Get(':id')
  get(@UuidParam() id: string): Promise<ServiceResponse> {
    return this.servicesService.get(id);
  }

  @Patch(':id')
  @Audit('update')
  update(@UuidParam() id: string, @Body() dto: UpdateServiceDto): Promise<ServiceResponse> {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.servicesService.delete(id);
  }
}
