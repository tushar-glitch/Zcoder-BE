import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { Paginated } from '../../../common/pagination/paginated.js';
import { UuidParam } from '../../../common/pipes/uuid-param.js';
import { Audit, AuditEntity } from '../../audit/audit.decorator.js';
import { CreateProjectDto, ProjectListQueryDto, UpdateProjectDto } from './dto/project.dto.js';
import { ProjectResponse, ProjectsService } from './projects.service.js';

@Controller('admin/projects')
@AuditEntity('project')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@Query() { published, q, sort, page, pageSize }: ProjectListQueryDto): Promise<Paginated<ProjectResponse>> {
    return this.projectsService.search({ published, q, sort }, { page, pageSize });
  }

  @Post()
  @Audit('create')
  create(@Body() dto: CreateProjectDto): Promise<ProjectResponse> {
    return this.projectsService.create(dto);
  }

  @Get(':id')
  get(@UuidParam() id: string): Promise<ProjectResponse> {
    return this.projectsService.get(id);
  }

  @Patch(':id')
  @Audit('update')
  update(@UuidParam() id: string, @Body() dto: UpdateProjectDto): Promise<ProjectResponse> {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.projectsService.delete(id);
  }
}
