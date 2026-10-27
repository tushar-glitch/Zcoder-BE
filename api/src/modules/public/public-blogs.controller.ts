import { Controller, Get, Param, Query } from '@nestjs/common';
import { Paginated } from '../../common/pagination/paginated.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { BlogSummary } from '../blogs/blog.presenter.js';
import type { TaxonomyWithCountResponse } from '../taxonomy/taxonomy.presenter.js';
import { PublicBlogDetailQueryDto, PublicBlogListQueryDto } from './dto/public-query.dto.js';
import { PublicBlogResponse, PublicBlogsService } from './public-blogs.service.js';

@Public()
@Controller('public')
export class PublicBlogsController {
  constructor(private readonly blogs: PublicBlogsService) {}

  @Get('blogs')
  list(@Query() query: PublicBlogListQueryDto): Promise<Paginated<BlogSummary>> {
    return this.blogs.list(query);
  }

  @Get('blogs/:slug')
  detail(@Param('slug') slug: string, @Query() { format }: PublicBlogDetailQueryDto): Promise<PublicBlogResponse> {
    return this.blogs.detail(slug, format);
  }

  @Get('categories')
  categories(): Promise<TaxonomyWithCountResponse[]> {
    return this.blogs.categories();
  }

  @Get('tags')
  tags(): Promise<TaxonomyWithCountResponse[]> {
    return this.blogs.tags();
  }
}
