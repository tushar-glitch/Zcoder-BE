import { Injectable } from '@nestjs/common';
import { ValidationDetail, ValidationException } from '../../common/exceptions/validation.exception.js';
import { MediaRepository } from './media.repository.js';

export type MediaReference = string | string[] | null | undefined;

@Injectable()
export class MediaReferences {
  constructor(private readonly repository: MediaRepository) {}

  async assertExist(references: Record<string, MediaReference>): Promise<void> {
    const wanted = Object.entries(references).flatMap(([path, value]) =>
      [value ?? []].flat().map((id) => ({ path, id })),
    );
    if (wanted.length === 0) {
      return;
    }

    const existing = await this.repository.findExistingIds(wanted.map(({ id }) => id));
    const missing = [...new Set(wanted.filter(({ id }) => !existing.has(id)).map(({ path }) => path))];
    if (missing.length > 0) {
      throw new ValidationException(missing.map((path): ValidationDetail => ({ path, message: `${path} does not match any media` })));
    }
  }
}
