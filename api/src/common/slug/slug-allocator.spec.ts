import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { allocateSlug } from './slug-allocator.js';

const taken = (...slugs: string[]) => async (slug: string) => slugs.includes(slug);

describe('allocateSlug', () => {
  it('derives a slug from the source text', async () => {
    expect(await allocateSlug({ source: 'Web Development', fallback: 'x', isTaken: taken() })).toBe('web-development');
  });

  it('numbers a derived slug that is already taken', async () => {
    expect(await allocateSlug({ source: 'Web', fallback: 'x', isTaken: taken('web', 'web-2') })).toBe('web-3');
  });

  it('falls back when the source has no usable characters', async () => {
    expect(await allocateSlug({ source: '!!!', fallback: 'untitled', isTaken: taken() })).toBe('untitled');
  });

  it('uses a requested slug as-is', async () => {
    expect(await allocateSlug({ requested: 'custom', source: 'Other', fallback: 'x', isTaken: taken() })).toBe('custom');
  });

  it('refuses a requested slug that is taken', async () => {
    await expect(
      allocateSlug({ requested: 'custom', source: 'Other', fallback: 'x', isTaken: taken('custom') }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
