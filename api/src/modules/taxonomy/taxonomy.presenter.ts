import { Injectable } from '@nestjs/common';
import type { Author, Media } from '../../generated/prisma/client.js';
import { MediaPresenter } from '../media/media.presenter.js';
import type { MediaRef } from '../media/media.presenter.js';

export interface TaxonomyRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export type TaxonomyRowWithCount = TaxonomyRow & { _count: { blogs: number } };

export type AuthorRow = Author & { avatar: Media | null };

export interface TaxonomyResponse extends TaxonomyRow {}

export interface TaxonomyWithCountResponse extends TaxonomyRow {
  postCount: number;
}

export interface AuthorResponse {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatar: MediaRef | null;
}

@Injectable()
export class TaxonomyPresenter {
  constructor(private readonly media: MediaPresenter) {}

  taxonomy({ id, name, slug, description }: TaxonomyRow): TaxonomyResponse {
    return { id, name, slug, description };
  }

  taxonomyWithCount(row: TaxonomyRowWithCount): TaxonomyWithCountResponse {
    return { ...this.taxonomy(row), postCount: row._count.blogs };
  }

  author({ id, name, slug, bio, avatar }: AuthorRow): AuthorResponse {
    return { id, name, slug, bio, avatar: this.media.refOrNull(avatar) };
  }
}
