import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

export const SLUG_MAX_LENGTH = 80;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  let candidate = base;
  for (let suffix = 2; await isTaken(candidate); suffix++) {
    const tail = `-${suffix}`;
    candidate = `${base.slice(0, SLUG_MAX_LENGTH - tail.length).replace(/-+$/g, '')}${tail}`;
  }
  return candidate;
}

export const IsSlug = (): PropertyDecorator =>
  applyDecorators(
    IsString(),
    MaxLength(SLUG_MAX_LENGTH),
    Matches(SLUG_PATTERN, { message: 'slug may only contain lowercase letters, numbers and single hyphens' }),
  );
