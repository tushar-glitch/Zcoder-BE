import { Module } from '@nestjs/common';
import { ImageProcessor } from './image/image-processor.js';
import { SharpImageProcessor } from './image/sharp-image-processor.js';
import { MediaController } from './media.controller.js';
import { MediaReferences } from './media-references.js';
import { MediaPresenter } from './media.presenter.js';
import { MediaRepository } from './media.repository.js';
import { MediaService } from './media.service.js';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaRepository,
    MediaPresenter,
    MediaReferences,
    { provide: ImageProcessor, useClass: SharpImageProcessor },
  ],
  exports: [MediaPresenter, MediaRepository, MediaReferences],
})
export class MediaModule {}
