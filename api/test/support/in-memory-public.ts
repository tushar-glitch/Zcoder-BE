import type { PageRequest } from '../../src/common/pagination/paginated.js';
import { BlogStatus, Category, Faq, Tag } from '../../src/generated/prisma/client.js';
import type { BlogWithRelations } from '../../src/modules/blogs/blog.presenter.js';
import type { ProjectRow } from '../../src/modules/content/projects/projects.repository.js';
import type { ServiceRow } from '../../src/modules/content/services/services.repository.js';
import type { TestimonialRow } from '../../src/modules/content/testimonials/testimonials.repository.js';
import type { HeroRow } from '../../src/modules/hero/hero.repository.js';
import type { BlogQuery, ProjectQuery, SitemapEntries, SitemapEntry } from '../../src/modules/public/public.repository.js';
import type { TaxonomyRowWithCount } from '../../src/modules/taxonomy/taxonomy.presenter.js';
import type { InMemoryBlogsRepository, InMemoryCatalog } from './in-memory-blogs.js';
import type {
  InMemoryFaqsRepository,
  InMemoryHeroRepository,
  InMemoryProjectsRepository,
  InMemoryServicesRepository,
  InMemoryTestimonialsRepository,
} from './in-memory-site-content.js';

const WHOLE_LIST: PageRequest = { page: 1, pageSize: 100_000 };

const paginate = <T>(items: T[], { page, pageSize }: PageRequest) => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  total: items.length,
});

const entry = ({ slug, updatedAt }: { slug: string; updatedAt: Date }): SitemapEntry => ({ slug, lastModified: updatedAt });

export class InMemoryPublicRepository {
  constructor(
    private readonly heroes: InMemoryHeroRepository,
    private readonly services: InMemoryServicesRepository,
    private readonly projects: InMemoryProjectsRepository,
    private readonly testimonials: InMemoryTestimonialsRepository,
    private readonly faqs: InMemoryFaqsRepository,
    private readonly blogs: InMemoryBlogsRepository,
    private readonly catalog: InMemoryCatalog,
  ) {}

  async findPublishedHero(): Promise<HeroRow | null> {
    return (await this.heroes.findAll()).find((hero) => hero.status === 'PUBLISHED') ?? null;
  }

  async findPublishedServices(): Promise<ServiceRow[]> {
    return (await this.services.findAll()).filter((service) => service.isPublished);
  }

  async findPublishedService(slug: string): Promise<ServiceRow | null> {
    return (await this.findPublishedServices()).find((service) => service.slug === slug) ?? null;
  }

  async findPublishedProjects({ featured, technology }: ProjectQuery, page: PageRequest) {
    const matching = (await this.projects.findAll())
      .filter((project) => project.isPublished)
      .filter((project) => featured === undefined || project.isFeatured === featured)
      .filter((project) => !technology || project.technologies.includes(technology));
    return paginate(matching, page);
  }

  async findPublishedProject(slug: string): Promise<ProjectRow | null> {
    return (await this.projects.findAll()).find((project) => project.isPublished && project.slug === slug) ?? null;
  }

  async findPublishedTestimonials(limit: number): Promise<TestimonialRow[]> {
    return (await this.testimonials.findAll()).filter((row) => row.isPublished).slice(0, limit);
  }

  async findPublishedFaqs(homeOnly: boolean): Promise<Faq[]> {
    return (await this.faqs.findAll()).filter((faq) => faq.isPublished && (!homeOnly || faq.showOnHome));
  }

  private async publishedBlogs(): Promise<BlogWithRelations[]> {
    const { items } = await this.blogs.findPage({ status: BlogStatus.PUBLISHED }, { publishedAt: 'desc' }, WHOLE_LIST);
    return items;
  }

  async findPublishedBlogs({ category, tag, q }: BlogQuery, page: PageRequest) {
    const needle = q?.toLowerCase();
    const matching = (await this.publishedBlogs())
      .filter((blog) => !category || blog.category?.slug === category)
      .filter((blog) => !tag || blog.tags.some((link) => link.tag.slug === tag))
      .filter((blog) => !needle || `${blog.title} ${blog.excerpt ?? ''}`.toLowerCase().includes(needle));
    return paginate(matching, page);
  }

  async findPublishedBlog(slug: string): Promise<BlogWithRelations | null> {
    return (await this.publishedBlogs()).find((blog) => blog.slug === slug) ?? null;
  }

  async findRenamedBlogSlug(oldSlug: string): Promise<string | null> {
    const renamed = this.catalog.history.find((item) => item.slug === oldSlug);
    const blog = renamed && this.catalog.blogs.get(renamed.blogId);
    return blog?.status === BlogStatus.PUBLISHED ? blog.slug : null;
  }

  async findRelatedBlogs(blog: BlogWithRelations, limit: number): Promise<BlogWithRelations[]> {
    const tagIds = blog.tags.map((link) => link.tagId);
    return (await this.publishedBlogs())
      .filter((candidate) => candidate.id !== blog.id)
      .filter(
        (candidate) =>
          (blog.categoryId && candidate.categoryId === blog.categoryId) ||
          candidate.tags.some((link) => tagIds.includes(link.tagId)),
      )
      .slice(0, limit);
  }

  private async withPostCount<T extends Category | Tag>(
    rows: Map<string, T>,
    count: (blog: BlogWithRelations, id: string) => boolean,
  ): Promise<TaxonomyRowWithCount[]> {
    const blogs = await this.publishedBlogs();
    return [...rows.values()]
      .map((row) => ({ ...row, _count: { blogs: blogs.filter((blog) => count(blog, row.id)).length } }))
      .filter((row) => row._count.blogs > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  findCategoriesWithPosts(): Promise<TaxonomyRowWithCount[]> {
    return this.withPostCount(this.catalog.categories, (blog, id) => blog.categoryId === id);
  }

  findTagsWithPosts(): Promise<TaxonomyRowWithCount[]> {
    return this.withPostCount(this.catalog.tags, (blog, id) => blog.tags.some((link) => link.tagId === id));
  }

  async findSitemapEntries(): Promise<SitemapEntries> {
    const [categories, tags] = [await this.findCategoriesWithPosts(), await this.findTagsWithPosts()];
    return {
      blogs: (await this.publishedBlogs()).map(entry),
      projects: (await this.projects.findAll()).filter((project) => project.isPublished).map(entry),
      categories: categories.map(entry),
      tags: tags.map(entry),
    };
  }
}
