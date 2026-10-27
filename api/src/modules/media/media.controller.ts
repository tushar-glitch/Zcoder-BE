import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminListQueryDto } from '../../common/pagination/page-query.dto.js';
import { Paginated } from '../../common/pagination/paginated.js';
import { UuidParam } from '../../common/pipes/uuid-param.js';
import { Audit } from '../audit/audit.decorator.js';
import { MediaAltTextDto } from './dto/media-alt-text.dto.js';
import { MAX_UPLOAD_BYTES } from './media.constants.js';
import { MediaResponse } from './media.presenter.js';
import { MediaService, UploadedImage } from './media.service.js';

@Controller('admin/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  list(@Query() { q, sort, page, pageSize }: AdminListQueryDto): Promise<Paginated<MediaResponse>> {
    return this.mediaService.list({ q, sort }, { page, pageSize });
  }

  @Post()
  @Audit('media.upload', 'media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(@UploadedFile() file: UploadedImage | undefined, @Body() dto: MediaAltTextDto): Promise<MediaResponse> {
    return this.mediaService.upload(file, dto.altText);
  }

  @Patch(':id')
  @Audit('media.update', 'media')
  updateAltText(@UuidParam() id: string, @Body() dto: MediaAltTextDto): Promise<MediaResponse> {
    return this.mediaService.updateAltText(id, dto.altText);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('media.delete', 'media')
  delete(@UuidParam() id: string): Promise<void> {
    return this.mediaService.delete(id);
  }
}
