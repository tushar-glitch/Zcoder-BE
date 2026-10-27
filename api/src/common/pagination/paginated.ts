export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageMeta extends PageRequest {
  total: number;
  totalPages: number;
}

export class Paginated<T> {
  private constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}

  static of<T>(items: T[], total: number, { page, pageSize }: PageRequest): Paginated<T> {
    return new Paginated(items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  }

  map<U>(transform: (item: T) => U): Paginated<U> {
    return new Paginated(this.items.map(transform), this.meta);
  }
}

export function toSkipTake({ page, pageSize }: PageRequest): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
