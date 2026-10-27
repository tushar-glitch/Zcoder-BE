import { Module } from '@nestjs/common';
import { ImageProcessor } from './image/image-processor.js';
import { SharpImageProcessor } from './image/sharp-image-processor.js';
import { MediaController } from './media.controller.js';
import { MediaPresenter } from './media.presenter.js';
import { MediaRepository } from './media.repository.js';
import { MediaService } from './media.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaRepository, MediaPresenter, { provide: ImageProcessor, useClass: SharpImageProcessor }],
  exports: [MediaPresenter, MediaRepository],
})
export class MediaModule {}
