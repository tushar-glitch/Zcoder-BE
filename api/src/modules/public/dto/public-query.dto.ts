import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PublicPageQueryDto } from '../../../common/pagination/page-query.dto.js';
import type { ContentFormat } from '../../blogs/blog.presenter.js';

const toBoolean = (): PropertyDecorator =>
  Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));

export class PublicBlogListQueryDto extends PublicPageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class PublicBlogDetailQueryDto {
  @IsOptional()
  @IsIn(['html', 'json'])
  format: ContentFormat = 'html';
}

export class PublicProjectListQueryDto extends PublicPageQueryDto {
  @IsOptional()
  @toBoolean()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  technology?: string;
}

export class PublicFaqQueryDto {
  @IsOptional()
  @toBoolean()
  @IsBoolean()
  home?: boolean;
}
