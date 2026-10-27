export interface ContentRepository<TRow extends { id: string }, TData> {
  findAll(): Promise<TRow[]>;
  findById(id: string): Promise<TRow | null>;
  create(data: TData): Promise<TRow>;
  update(id: string, data: Partial<TData>): Promise<TRow>;
  delete(id: string): Promise<void>;
  nextSortOrder(): Promise<number>;
}
