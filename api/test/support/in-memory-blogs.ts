import { randomUUID } from 'node:crypto';
import type { ValidationDetail } from '../../src/common/exceptions/validation.exception.js';
import type { PageRequest } from '../../src/common/pagination/paginated.js';
import { Author, Blog, BlogStatus, Category, Prisma, Tag } from '../../src/generated/prisma/client.js';
import type { AuthorData } from '../../src/modules/taxonomy/authors.repository.js';
import type { BlogWithRelations } from '../../src/modules/blogs/blog.presenter.js';
import type {
  BlogChange,
  BlogFilters,
  BlogOrderBy,
  BlogReferences,
  NewBlog,
} from '../../src/modules/blogs/blogs.repository.js';
import type { AuthorRow, TaxonomyRowWithCount } from '../../src/modules/taxonomy/taxonomy.presenter.js';
import { TaxonomyData, TaxonomyRepository } from '../../src/modules/taxonomy/taxonomy.repository.js';
import type { InMemoryMediaRepository } from './in-memory-content.js';

const foreignKeyError = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' });

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

export class InMemoryCatalog {
  readonly categories = new Map<string, Category>();
  readonly tags = new Map<string, Tag>();
  readonly authors = new Map<string, Author>();
  readonly blogs = new Map<string, Blog>();
  readonly blogTags = new Map<string, string[]>();
  readonly history: { blogId: string; slug: string }[] = [];

  constructor(readonly media: InMemoryMediaRepository) {}

  addCategory(name: string): Category {
    const category: Category = { id: randomUUID(), name, slug: name.toLowerCase(), description: null, createdAt: new Date(), updatedAt: new Date() };
    this.categories.set(category.id, category);
    return category;
  }

  addTag(name: string): Tag {
    const tag: Tag = { id: randomUUID(), name, slug: name.toLowerCase(), description: null, createdAt: new Date(), updatedAt: new Date() };
    this.tags.set(tag.id, tag);
    return tag;
  }

  addAuthor(name: string): Author {
    const author: Author = { id: randomUUID(), name, slug: name.toLowerCase().replace(/\s+/g, '-'), bio: null, avatarId: null, createdAt: new Date(), updatedAt: new Date() };
    this.authors.set(author.id, author);
    return author;
  }
}

class InMemoryTaxonomyRepository<T extends Category | Tag> extends TaxonomyRepository {
  constructor(
    private readonly rows: Map<string, T>,
    private readonly postCount: (id: string) => number,
    private readonly remove: (id: string) => void,
  ) {
    super();
  }

  private withCount(row: T): TaxonomyRowWithCount {
    return { ...row, _count: { blogs: this.postCount(row.id) } };
  }

  async findAll(): Promise<TaxonomyRowWithCount[]> {
    return [...this.rows.values()].sort(byName).map((row) => this.withCount(row));
  }

  async findById(id: string): Promise<TaxonomyRowWithCount | null> {
    const row = this.rows.get(id);
    return row ? this.withCount(row) : null;
  }

  async create(data: TaxonomyData): Promise<TaxonomyRowWithCount> {
    const row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data } as T;
    this.rows.set(row.id, row);
    return this.withCount(row);
  }

  async update(id: string, data: Partial<TaxonomyData>): Promise<TaxonomyRowWithCount> {
    const row = this.rows.get(id)!;
    Object.entries(data).forEach(([key, value]) => value !== undefined && Object.assign(row, { [key]: value }));
    return this.withCount(row);
  }

  async delete(id: string): Promise<void> {
    this.remove(id);
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.slug === slug && row.id !== excludeId);
  }

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.name.toLowerCase() === name.toLowerCase() && row.id !== excludeId);
  }
}

export const createCategoriesRepository = (catalog: InMemoryCatalog) =>
  new InMemoryTaxonomyRepository(
    catalog.categories,
    (id) => [...catalog.blogs.values()].filter((blog) => blog.categoryId === id).length,
    (id) => {
      if ([...catalog.blogs.values()].some((blog) => blog.categoryId === id)) {
        throw foreignKeyError();
      }
      catalog.categories.delete(id);
    },
  );

export const createTagsRepository = (catalog: InMemoryCatalog) =>
  new InMemoryTaxonomyRepository(
    catalog.tags,
    (id) => [...catalog.blogTags.values()].filter((tagIds) => tagIds.includes(id)).length,
    (id) => {
      catalog.tags.delete(id);
      catalog.blogTags.forEach((tagIds, blogId) => catalog.blogTags.set(blogId, tagIds.filter((tagId) => tagId !== id)));
    },
  );

export class InMemoryAuthorsRepository {
  constructor(private readonly catalog: InMemoryCatalog) {}

  private hydrate(author: Author): AuthorRow {
    return { ...author, avatar: (author.avatarId && this.catalog.media.items.get(author.avatarId)) || null };
  }

  private assertAvatarExists(avatarId: string | null | undefined): void {
    if (avatarId && !this.catalog.media.items.has(avatarId)) {
      throw foreignKeyError();
    }
  }

  async findAll(): Promise<AuthorRow[]> {
    return [...this.catalog.authors.values()].sort(byName).map((author) => this.hydrate(author));
  }

  async findById(id: string): Promise<AuthorRow | null> {
    const author = this.catalog.authors.get(id);
    return author ? this.hydrate(author) : null;
  }

  async create(data: AuthorData): Promise<AuthorRow> {
    this.assertAvatarExists(data.avatarId);
    const author: Author = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
    this.catalog.authors.set(author.id, author);
    return this.hydrate(author);
  }

  async update(id: string, data: Partial<AuthorData>): Promise<AuthorRow> {
    this.assertAvatarExists(data.avatarId);
    const author = this.catalog.authors.get(id)!;
    Object.entries(data).forEach(([key, value]) => value !== undefined && Object.assign(author, { [key]: value }));
    return this.hydrate(author);
  }

  async delete(id: string): Promise<void> {
    if ([...this.catalog.blogs.values()].some((blog) => blog.authorId === id)) {
      throw foreignKeyError();
    }
    this.catalog.authors.delete(id);
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return [...this.catalog.authors.values()].some((author) => author.slug === slug && author.id !== excludeId);
  }
}

export class InMemoryBlogsRepository {
  constructor(private readonly catalog: InMemoryCatalog) {}

  private hydrate(blog: Blog): BlogWithRelations {
    const { categories, authors, media, tags, blogTags } = this.catalog;
    const author = blog.authorId ? authors.get(blog.authorId) : undefined;
    return {
      ...blog,
      category: (blog.categoryId && categories.get(blog.categoryId)) || null,
      author: author ? { ...author, avatar: (author.avatarId && media.items.get(author.avatarId)) || null } : null,
      coverImage: (blog.coverImageId && media.items.get(blog.coverImageId)) || null,
      ogImage: (blog.ogImageId && media.items.get(blog.ogImageId)) || null,
      tags: (blogTags.get(blog.id) ?? [])
        .map((tagId) => ({ blogId: blog.id, tagId, tag: tags.get(tagId)! }))
        .sort((a, b) => byName(a.tag, b.tag)),
    };
  }

  private apply(blog: Blog, data: object): void {
    Object.entries(data).forEach(([key, value]) => value !== undefined && Object.assign(blog, { [key]: value }));
    blog.updatedAt = new Date();
  }

  async create(data: NewBlog, tagIds: string[]): Promise<BlogWithRelations> {
    const blog = {
      id: randomUUID(),
      excerpt: null,
      contentJson: null,
      contentHtml: null,
      coverImageId: null,
      ogImageId: null,
      categoryId: null,
      authorId: null,
      status: BlogStatus.DRAFT,
      publishedAt: null,
      seoTitle: null,
      seoDescription: null,
      readingTimeMin: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Blog;
    this.apply(blog, data);
    this.catalog.blogs.set(blog.id, blog);
    this.catalog.blogTags.set(blog.id, tagIds);
    return this.hydrate(blog);
  }

  async findById(id: string): Promise<BlogWithRelations | null> {
    const blog = this.catalog.blogs.get(id);
    return blog ? this.hydrate(blog) : null;
  }

  async findPage({ status, categoryId, q }: BlogFilters, orderBy: BlogOrderBy, { page, pageSize }: PageRequest) {
    const needle = q?.toLowerCase();
    const [[field, direction]] = Object.entries(orderBy) as [[keyof BlogOrderBy, 'asc' | 'desc']];
    const matching = [...this.catalog.blogs.values()]
      .filter((blog) => (!status || blog.status === status) && (!categoryId || blog.categoryId === categoryId))
      .filter((blog) => !needle || `${blog.title} ${blog.slug} ${blog.excerpt ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => ((a[field] ?? 0) > (b[field] ?? 0) ? 1 : -1) * (direction === 'asc' ? 1 : -1));
    return { items: matching.slice((page - 1) * pageSize, page * pageSize).map((blog) => this.hydrate(blog)), total: matching.length };
  }

  async update(id: string, { data, tagIds, slugHistory }: BlogChange): Promise<BlogWithRelations> {
    const blog = this.catalog.blogs.get(id)!;
    if (slugHistory?.remove) {
      const index = this.catalog.history.findIndex((entry) => entry.blogId === id && entry.slug === slugHistory.remove);
      if (index >= 0) this.catalog.history.splice(index, 1);
    }
    if (slugHistory?.add) {
      this.catalog.history.push({ blogId: id, slug: slugHistory.add });
    }
    this.apply(blog, data);
    if (tagIds) {
      this.catalog.blogTags.set(id, tagIds);
    }
    return this.hydrate(blog);
  }

  async delete(id: string): Promise<void> {
    this.catalog.blogs.delete(id);
    this.catalog.blogTags.delete(id);
  }

  async slugTaken(slug: string, excludeBlogId?: string): Promise<boolean> {
    const current = [...this.catalog.blogs.values()].some((blog) => blog.slug === slug && blog.id !== excludeBlogId);
    const previous = this.catalog.history.some((entry) => entry.slug === slug && entry.blogId !== excludeBlogId);
    return current || previous;
  }

  async findMissingReferences({ categoryId, authorId, coverImageId, ogImageId, tagIds }: BlogReferences): Promise<ValidationDetail[]> {
    const { categories, authors, media, tags } = this.catalog;
    const problems: [string, string, boolean][] = [
      ['categoryId', 'category', !categoryId || categories.has(categoryId)],
      ['authorId', 'author', !authorId || authors.has(authorId)],
      ['coverImageId', 'media', !coverImageId || media.items.has(coverImageId)],
      ['ogImageId', 'media', !ogImageId || media.items.has(ogImageId)],
      ['tagIds', 'tag', (tagIds ?? []).every((id) => tags.has(id))],
    ];
    return problems
      .filter(([, , exists]) => !exists)
      .map(([path, label]) => ({ path, message: `${path} does not match an existing ${label}` }));
  }
}
