import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { Paginated } from '../../common/pagination/paginated.js';
import type { PageRequest } from '../../common/pagination/paginated.js';
import { parseSort } from '../../common/pagination/sort.js';
import type { Media } from '../../generated/prisma/client.js';
import { isForeignKeyViolation } from '../../infrastructure/database/prisma-errors.js';
import { FileStorage } from '../../infrastructure/storage/file-storage.js';
import { ImageProcessor } from './image/image-processor.js';
import { variantKey } from './media-keys.js';
import { MEDIA_MIME_TYPE, MEDIA_VARIANT_WIDTHS } from './media.constants.js';
import { MediaPresenter, MediaResponse } from './media.presenter.js';
import { MediaRepository } from './media.repository.js';

export interface UploadedImage {
  buffer: Buffer;
  originalname: string;
}

const SORTABLE_FIELDS = ['createdAt', 'fileName'] as const;
const MAX_FILE_NAME_LENGTH = 120;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly repository: MediaRepository,
    private readonly processor: ImageProcessor,
    private readonly storage: FileStorage,
    private readonly presenter: MediaPresenter,
  ) {}

  async list(query: { q?: string; sort?: string }, page: PageRequest): Promise<Paginated<MediaResponse>> {
    const orderBy = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const { items, total } = await this.repository.findPage({ q: query.q, orderBy }, page);
    return Paginated.of(items, total, page).map((media) => this.presenter.response(media));
  }

  async upload(file: UploadedImage | undefined, altText: string): Promise<MediaResponse> {
    if (!file) {
      throw new ValidationException([{ path: 'file', message: 'file is required' }]);
    }

    const image = await this.processor.process(file.buffer);
    const storageKey = this.newStorageKey();
    await Promise.all(image.variants.map(({ width, data }) => this.storage.put(variantKey(storageKey, width), data)));

    try {
      const media = await this.repository.create({
        fileName: basename(file.originalname).slice(0, MAX_FILE_NAME_LENGTH),
        altText,
        storageKey,
        mimeType: MEDIA_MIME_TYPE,
        sizeBytes: image.variants.at(-1)!.data.length,
        width: image.width,
        height: image.height,
      });
      return this.presenter.response(media);
    } catch (error) {
      await this.removeFiles(storageKey);
      throw error;
    }
  }

  async updateAltText(id: string, altText: string): Promise<MediaResponse> {
    await this.findOrThrow(id);
    return this.presenter.response(await this.repository.updateAltText(id, altText));
  }

  async delete(id: string): Promise<void> {
    const media = await this.findOrThrow(id);

    try {
      await this.repository.delete(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Media is still used by other content');
      }
      throw error;
    }
    await this.removeFiles(media.storageKey);
  }

  private async findOrThrow(id: string): Promise<Media> {
    const media = await this.repository.findById(id);
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    return media;
  }

  private newStorageKey(): string {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}/${month}/${randomUUID()}`;
  }

  private async removeFiles(storageKey: string): Promise<void> {
    const results = await Promise.allSettled(
      MEDIA_VARIANT_WIDTHS.map((width) => this.storage.delete(variantKey(storageKey, width))),
    );
    if (results.some((result) => result.status === 'rejected')) {
      this.logger.error(`Could not delete some files for ${storageKey}`);
    }
  }
}
