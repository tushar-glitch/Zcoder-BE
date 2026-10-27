import { ConflictException } from '@nestjs/common';
import { slugify, uniqueSlug } from './slug.js';

export interface SlugRequest {
  requested?: string | null;
  source: string;
  fallback: string;
  isTaken: (slug: string) => Promise<boolean>;
}

export async function allocateSlug({ requested, source, fallback, isTaken }: SlugRequest): Promise<string> {
  if (requested) {
    if (await isTaken(requested)) {
      throw new ConflictException('Slug is already in use');
    }
    return requested;
  }
  return uniqueSlug(slugify(source) || fallback, isTaken);
}
