import { Injectable } from '@nestjs/common';
import type { Media } from '../../generated/prisma/client.js';
import { FileStorage } from '../../infrastructure/storage/file-storage.js';
import { variantKey } from './media-keys.js';
import { LARGE_WIDTH, MEDIA_MIME_TYPE, MEDIUM_WIDTH, THUMBNAIL_WIDTH } from './media.constants.js';

export interface MediaRef {
  id: string;
  url: string;
  variants: { thumbnailUrl: string; mediumUrl: string };
  altText: string;
  width: number;
  height: number;
}

export interface MediaResponse extends MediaRef {
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

@Injectable()
export class MediaPresenter {
  constructor(private readonly storage: FileStorage) {}

  ref({ id, storageKey, altText, width, height }: Media): MediaRef {
    return {
      id,
      url: this.storage.urlFor(variantKey(storageKey, LARGE_WIDTH)),
      variants: {
        thumbnailUrl: this.storage.urlFor(variantKey(storageKey, THUMBNAIL_WIDTH)),
        mediumUrl: this.storage.urlFor(variantKey(storageKey, MEDIUM_WIDTH)),
      },
      altText,
      width,
      height,
    };
  }

  refOrNull(media: Media | null): MediaRef | null {
    return media ? this.ref(media) : null;
  }

  response(media: Media): MediaResponse {
    return { ...this.ref(media), mimeType: MEDIA_MIME_TYPE, sizeBytes: media.sizeBytes, createdAt: media.createdAt };
  }
}
