import { ValidationException } from '../exceptions/validation.exception.js';

export type SortDirection = 'asc' | 'desc';

export interface SortRule<Field extends string> {
  field: Field;
  direction: SortDirection;
}

export function parseSort<Field extends string>(
  sort: string | undefined,
  allowed: readonly Field[],
  fallback: SortRule<Field>,
): Record<Field, SortDirection> {
  if (!sort) {
    return { [fallback.field]: fallback.direction } as Record<Field, SortDirection>;
  }

  const [field, direction] = sort.split(':') as [Field, SortDirection];
  if (!allowed.includes(field)) {
    throw new ValidationException([{ path: 'sort', message: `sort field must be one of: ${allowed.join(', ')}` }]);
  }
  return { [field]: direction } as Record<Field, SortDirection>;
}
