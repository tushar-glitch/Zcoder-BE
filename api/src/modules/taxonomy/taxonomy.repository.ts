import type { TaxonomyRowWithCount } from './taxonomy.presenter.js';

export interface TaxonomyData {
  name: string;
  slug: string;
  description: string | null;
}

export abstract class TaxonomyRepository {
  abstract findAll(): Promise<TaxonomyRowWithCount[]>;
  abstract findById(id: string): Promise<TaxonomyRowWithCount | null>;
  abstract create(data: TaxonomyData): Promise<TaxonomyRowWithCount>;
  abstract update(id: string, data: Partial<TaxonomyData>): Promise<TaxonomyRowWithCount>;
  abstract delete(id: string): Promise<void>;
  abstract slugExists(slug: string, excludeId?: string): Promise<boolean>;
  abstract nameExists(name: string, excludeId?: string): Promise<boolean>;
}
