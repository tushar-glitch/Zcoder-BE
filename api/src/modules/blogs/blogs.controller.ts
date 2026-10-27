import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import { UuidParam } from '../../common/pipes/uuid-param.js';
import { Audit, AuditEntity } from '../audit/audit.decorator.js';
import { SlugAvailability } from './blog-slug.service.js';
import { AdminBlog, AdminBlogRow, PublicBlogDetail } from './blog.presenter.js';
import { BlogsService } from './blogs.service.js';
import { CreateBlogDto, UpdateBlogDto } from './dto/blog.dto.js';
import { BlogListQueryDto, ContentFormatQueryDto, SlugAvailableQueryDto } from './dto/blog-query.dto.js';

@Controller('admin/blogs')
@AuditEntity('blog')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  list(@Query() { status, categoryId, q, sort, page, pageSize }: BlogListQueryDto): Promise<Paginated<AdminBlogRow>> {
    return this.blogsService.list({ status, categoryId, q, sort }, { page, pageSize });
  }

  @Post()
  @Audit('create')
  create(@Body() dto: CreateBlogDto): Promise<AdminBlog> {
    return this.blogsService.create(dto);
  }

  @Get('slug-available')
  slugAvailable(@Query() { slug, excludeId }: SlugAvailableQueryDto): Promise<SlugAvailability> {
    return this.blogsService.slugAvailability(slug, excludeId);
  }

  @Get(':id')
  get(@UuidParam() id: string): Promise<AdminBlog> {
    return this.blogsService.get(id);
  }

  @Get(':id/preview')
  preview(@UuidParam() id: string, @Query() { format }: ContentFormatQueryDto): Promise<PublicBlogDetail> {
    return this.blogsService.preview(id, format);
  }

  @Patch(':id')
  @Audit('update')
  update(@UuidParam() id: string, @Body() dto: UpdateBlogDto): Promise<AdminBlog> {
    return this.blogsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('delete')
  delete(@UuidParam() id: string): Promise<void> {
    return this.blogsService.delete(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Audit('publish')
  publish(@UuidParam() id: string): Promise<AdminBlog> {
    return this.blogsService.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @Audit('unpublish')
  unpublish(@UuidParam() id: string): Promise<AdminBlog> {
    return this.blogsService.unpublish(id);
  }
}
