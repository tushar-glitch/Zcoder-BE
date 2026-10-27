import { describe, expect, it } from 'vitest';
import { ValidationException } from '../exceptions/validation.exception.js';
import { Paginated, toSkipTake } from './paginated.js';
import { parseSort } from './sort.js';

describe('Paginated', () => {
  it('computes the page meta', () => {
    const page = Paginated.of(['a', 'b'], 42, { page: 2, pageSize: 20 });

    expect(page.meta).toEqual({ page: 2, pageSize: 20, total: 42, totalPages: 3 });
  });

  it('keeps the meta when mapping items', () => {
    const page = Paginated.of([1, 2], 2, { page: 1, pageSize: 10 }).map((n) => n * 2);

    expect(page.items).toEqual([2, 4]);
    expect(page.meta.total).toBe(2);
  });

  it('reports zero pages for no results', () => {
    expect(Paginated.of([], 0, { page: 1, pageSize: 20 }).meta.totalPages).toBe(0);
  });
});

describe('toSkipTake', () => {
  it('skips the previous pages', () => {
    expect(toSkipTake({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
  });
});

describe('parseSort', () => {
  const allowed = ['createdAt', 'name'] as const;
  const fallback = { field: 'createdAt', direction: 'desc' } as const;

  it('falls back when no sort is given', () => {
    expect(parseSort(undefined, allowed, fallback)).toEqual({ createdAt: 'desc' });
  });

  it('parses an allowed field', () => {
    expect(parseSort('name:asc', allowed, fallback)).toEqual({ name: 'asc' });
  });

  it('rejects a field outside the allow-list', () => {
    expect(() => parseSort('passwordHash:asc', allowed, fallback)).toThrow(ValidationException);
  });
});
