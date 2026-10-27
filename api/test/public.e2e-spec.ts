import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TestApp } from './support/test-app.js';

const text = (value: string) => ({ type: 'text', text: value });
const doc = (...content: object[]) => ({ type: 'doc', content });
const paragraph = (value: string) => ({ type: 'paragraph', content: [text(value)] });

describe('public API', () => {
  let testApp: TestApp;
  const get = (path: string) => testApp.anonymous().get(`/api/v1/public${path}`);
  const post = (path: string, body: object) => testApp.admin.post(`/api/v1/admin${path}`).send(body);
  const image = () =>
    testApp.media.create({ fileName: 'i.png', altText: 'Alt text', storageKey: '2026/10/i', mimeType: 'image/webp', sizeBytes: 5, width: 1600, height: 800 });

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  describe('hero', () => {
    const complete = { title: 'Hero', heading: 'Real heading', subheading: 'Real subheading', primaryCta: { label: 'Go', url: '/contact' } };

    it('falls back to the built-in hero when nothing is published', async () => {
      await post('/hero', complete).expect(201);

      const response = await get('/hero').expect(200);

      expect(response.body.data).toMatchObject({ isDefault: true, primaryCta: { url: '/contact' }, image: null });
      expect(response.body.data).not.toHaveProperty('title');
    });

    it('returns the published hero with its image', async () => {
      const cover = await image();
      const hero = (await post('/hero', { ...complete, imageId: cover.id, secondaryCta: { label: 'More', url: '/more' } }).expect(201)).body.data;
      await testApp.admin.post(`/api/v1/admin/hero/${hero.id}/publish`).expect(200);

      const response = await get('/hero').expect(200);

      expect(response.body.data).toMatchObject({
        isDefault: false,
        heading: 'Real heading',
        secondaryCta: { label: 'More', url: '/more' },
        image: { id: cover.id, altText: 'Alt text' },
      });
    });
  });

  describe('services', () => {
    it('lists only published services in order and resolves SEO fallbacks', async () => {
      await post('/services', { title: 'Second', shortDescription: 'Short copy', isPublished: true, sortOrder: 5 }).expect(201);
      await post('/services', { title: 'First', isPublished: true, sortOrder: 1 }).expect(201);
      await post('/services', { title: 'Hidden' }).expect(201);

      const response = await get('/services').expect(200);

      expect(response.body.data.map((s: { title: string }) => s.title)).toEqual(['First', 'Second']);
      expect(response.body.data[1]).toMatchObject({ seoTitle: 'Second', seoDescription: 'Short copy', ogImage: null });
      expect(response.body.data[0]).not.toHaveProperty('isPublished');
    });

    it('returns a service by slug and 404s for drafts and unknown slugs', async () => {
      await post('/services', { title: 'Web Apps', isPublished: true, seoTitle: 'Custom SEO' }).expect(201);
      await post('/services', { title: 'Hidden' }).expect(201);

      const found = await get('/services/web-apps').expect(200);

      expect(found.body.data).toMatchObject({ slug: 'web-apps', seoTitle: 'Custom SEO' });
      await get('/services/hidden').expect(404);
      await get('/services/nope').expect(404);
    });
  });

  describe('projects', () => {
    const create = (title: string, extra: object = {}) => post('/projects', { title, isPublished: true, ...extra }).expect(201);

    it('lists only published projects, filters by technology and omits admin-only fields', async () => {
      await create('Portal', { technologies: ['Next.js'], sourceUrl: 'https://git.example/x', clientName: 'Acme' });
      await create('Mobile', { technologies: ['Flutter'] });
      await post('/projects', { title: 'Draft', technologies: ['Next.js'] }).expect(201);

      const all = (await get('/projects').expect(200)).body;
      const filtered = (await get('/projects?technology=Next.js').expect(200)).body;

      expect(all.meta.total).toBe(2);
      expect(filtered.data.map((p: { title: string }) => p.title)).toEqual(['Portal']);
      expect(JSON.stringify(all)).not.toMatch(/sourceUrl|clientName|git\.example/);
    });

    it('caps the featured list at 6 and pages the rest', async () => {
      for (let n = 1; n <= 8; n++) await create(`Featured ${n}`, { isFeatured: true });
      await create('Plain');

      const featured = (await get('/projects?featured=true&pageSize=20').expect(200)).body;
      const second = (await get('/projects?pageSize=4&page=3').expect(200)).body;

      expect(featured.data).toHaveLength(6);
      expect(featured.meta).toMatchObject({ pageSize: 6, total: 8 });
      expect(second.data).toHaveLength(1);
      await get('/projects?featured=maybe').expect(400);
      await get('/projects?pageSize=51').expect(400);
    });

    it('returns the detail with an ordered gallery, SEO fallbacks and no admin-only fields', async () => {
      const [cover, first, second] = [await image(), await image(), await image()];
      await create('Portal', {
        summary: 'A customer portal',
        coverImageId: cover.id,
        galleryImageIds: [second.id, first.id],
        demoUrl: 'https://demo.example.com',
        sourceUrl: 'https://git.example/x',
        clientName: 'Acme',
      });

      const { data } = (await get('/projects/portal').expect(200)).body;

      expect(data.gallery.map((g: { image: { id: string } }) => g.image.id)).toEqual([second.id, first.id]);
      expect(data).toMatchObject({ seoTitle: 'Portal', seoDescription: 'A customer portal', demoUrl: 'https://demo.example.com' });
      expect(data.ogImage.id).toBe(cover.id);
      expect(data).not.toHaveProperty('sourceUrl');
      expect(data).not.toHaveProperty('clientName');
    });

    it('404s for drafts and unknown slugs', async () => {
      await post('/projects', { title: 'Draft' }).expect(201);

      await get('/projects/draft').expect(404);
      await get('/projects/nope').expect(404);
    });
  });

  describe('testimonials and faqs', () => {
    const quote = 'A quote that is comfortably longer than twenty characters.';

    it('returns at most 6 published testimonials without admin fields', async () => {
      for (let n = 1; n <= 7; n++) {
        await post('/testimonials', { clientName: `Client ${n}`, quote, clientApproved: true, isPublished: true }).expect(201);
      }
      await post('/testimonials', { clientName: 'Draft', quote }).expect(201);

      const { data } = (await get('/testimonials').expect(200)).body;

      expect(data).toHaveLength(6);
      expect(data[0]).not.toHaveProperty('clientApproved');
      expect(data.map((t: { clientName: string }) => t.clientName)).not.toContain('Draft');
    });

    it('returns published FAQs and only the home ones when asked', async () => {
      await post('/faqs', { question: 'On home?', answer: 'Yes.', isPublished: true, showOnHome: true }).expect(201);
      await post('/faqs', { question: 'Elsewhere?', answer: 'Yes.', isPublished: true, group: 'Billing' }).expect(201);
      await post('/faqs', { question: 'Draft?', answer: 'No.', showOnHome: true }).expect(201);

      const all = (await get('/faqs').expect(200)).body.data;
      const home = (await get('/faqs?home=true').expect(200)).body.data;

      expect(all.map((f: { question: string }) => f.question)).toEqual(['On home?', 'Elsewhere?']);
      expect(home.map((f: { question: string }) => f.question)).toEqual(['On home?']);
      expect(all[1].group).toBe('Billing');
      expect(all[0]).not.toHaveProperty('showOnHome');
    });
  });

  describe('blogs', () => {
    let categoryId: string;
    let authorId: string;
    let coverImageId: string;

    beforeEach(async () => {
      categoryId = testApp.catalog.addCategory('Engineering').id;
      authorId = testApp.catalog.addAuthor('Priya Sharma').id;
      coverImageId = (await image()).id;
    });

    async function publishedBlog(title: string, daysAgo: number, extra: object = {}) {
      const blog = (
        await post('/blogs', {
          title,
          excerpt: `${title} `.padEnd(80, 'x'),
          seoDescription: 's'.repeat(100),
          categoryId,
          authorId,
          coverImageId,
          contentJson: doc(paragraph(`Body of ${title}`)),
          publishedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
          ...extra,
        }).expect(201)
      ).body.data;
      await testApp.admin.post(`/api/v1/admin/blogs/${blog.id}/publish`).expect(200);
      return blog;
    }

    it('lists published posts newest first and hides drafts and content', async () => {
      await publishedBlog('Older post here', 10);
      await publishedBlog('Newer post here', 1);
      await post('/blogs', { title: 'Draft post here' }).expect(201);

      const { data, meta } = (await get('/blogs').expect(200)).body;

      expect(data.map((b: { title: string }) => b.title)).toEqual(['Newer post here', 'Older post here']);
      expect(meta.total).toBe(2);
      expect(data[0]).toMatchObject({ category: { slug: 'engineering' }, author: { name: 'Priya Sharma' } });
      expect(data[0]).not.toHaveProperty('contentHtml');
      expect(data[0]).not.toHaveProperty('contentJson');
    });

    it('filters by category, tag and search text', async () => {
      const react = testApp.catalog.addTag('React');
      const other = testApp.catalog.addCategory('Design');
      await publishedBlog('React hooks guide', 3, { tagIds: [react.id] });
      await publishedBlog('Design systems', 2, { categoryId: other.id });

      const byCategory = (await get('/blogs?category=design').expect(200)).body.data;
      const byTag = (await get('/blogs?tag=react').expect(200)).body.data;
      const search = (await get('/blogs?q=HOOKS').expect(200)).body.data;

      expect(byCategory.map((b: { title: string }) => b.title)).toEqual(['Design systems']);
      expect(byTag.map((b: { title: string }) => b.title)).toEqual(['React hooks guide']);
      expect(search).toHaveLength(1);
      expect((await get('/blogs?category=nope').expect(200)).body.data).toEqual([]);
    });

    it('returns HTML by default and JSON on request, never both', async () => {
      await publishedBlog('A detailed post', 1);

      const html = (await get('/blogs/a-detailed-post').expect(200)).body.data;
      const json = (await get('/blogs/a-detailed-post?format=json').expect(200)).body.data;

      expect(html.contentHtml).toContain('Body of A detailed post');
      expect(html).not.toHaveProperty('contentJson');
      expect(json.contentJson.type).toBe('doc');
      expect(json).not.toHaveProperty('contentHtml');
      expect(html).toMatchObject({ seoTitle: 'A detailed post', related: [] });
      await get('/blogs/a-detailed-post?format=xml').expect(400);
    });

    it('lists up to 3 related posts that share the category or a tag, excluding itself', async () => {
      const design = testApp.catalog.addCategory('Design');
      await publishedBlog('Main post here', 1);
      for (let n = 1; n <= 4; n++) await publishedBlog(`Same category ${n}`, 2 + n);
      await publishedBlog('Unrelated post', 1, { categoryId: design.id });

      const { related } = (await get('/blogs/main-post-here').expect(200)).body.data;

      expect(related).toHaveLength(3);
      expect(related.map((b: { title: string }) => b.title)).not.toContain('Main post here');
      expect(related.map((b: { title: string }) => b.title)).not.toContain('Unrelated post');
    });

    it('404s for drafts and unknown slugs', async () => {
      await post('/blogs', { title: 'Draft post here' }).expect(201);

      await get('/blogs/draft-post-here').expect(404);
      await get('/blogs/nope').expect(404);
    });

    it('answers a renamed slug with redirectTo and 404s once the blog is unpublished', async () => {
      const blog = await publishedBlog('Original title here', 1);
      await testApp.admin.patch(`/api/v1/admin/blogs/${blog.id}`).send({ slug: 'new-slug' }).expect(200);

      const redirect = await get('/blogs/original-title-here').expect(200);
      expect(redirect.body.data).toEqual({ redirectTo: 'new-slug' });

      await testApp.admin.post(`/api/v1/admin/blogs/${blog.id}/unpublish`).expect(200);
      await get('/blogs/original-title-here').expect(404);
    });

    it('supports conditional requests with an ETag', async () => {
      await publishedBlog('A cacheable post', 1);
      const first = await get('/blogs/a-cacheable-post').expect(200);

      await get('/blogs/a-cacheable-post').set('If-None-Match', first.headers.etag).expect(304);
    });

    it('counts only published posts in categories and tags and hides empty ones', async () => {
      const react = testApp.catalog.addTag('React');
      testApp.catalog.addTag('Unused');
      testApp.catalog.addCategory('Empty');
      await publishedBlog('First react post', 3, { tagIds: [react.id] });
      await publishedBlog('Second react post', 2, { tagIds: [react.id] });
      await post('/blogs', { title: 'Draft react post', categoryId, tagIds: [react.id] }).expect(201);

      const categories = (await get('/categories').expect(200)).body.data;
      const tags = (await get('/tags').expect(200)).body.data;

      expect(categories).toEqual([expect.objectContaining({ slug: 'engineering', postCount: 2 })]);
      expect(tags).toEqual([expect.objectContaining({ slug: 'react', postCount: 2 })]);
    });
  });

  describe('sitemap entries', () => {
    it('lists published blogs, projects, categories and tags with last-modified dates', async () => {
      const categoryId = testApp.catalog.addCategory('Engineering').id;
      const authorId = testApp.catalog.addAuthor('Priya Sharma').id;
      const tag = testApp.catalog.addTag('React');
      testApp.catalog.addTag('Unused');
      const coverImageId = (await image()).id;
      const blog = (
        await post('/blogs', {
          title: 'Sitemap post here',
          excerpt: 'e'.repeat(80),
          seoDescription: 's'.repeat(100),
          categoryId,
          authorId,
          coverImageId,
          tagIds: [tag.id],
          contentJson: doc(paragraph('Body')),
        }).expect(201)
      ).body.data;
      await testApp.admin.post(`/api/v1/admin/blogs/${blog.id}/publish`).expect(200);
      await post('/blogs', { title: 'Draft only post' }).expect(201);
      await post('/projects', { title: 'Live project', isPublished: true }).expect(201);
      await post('/projects', { title: 'Draft project' }).expect(201);

      const { data } = (await get('/sitemap-entries').expect(200)).body;

      expect(data.blogs.map((e: { slug: string }) => e.slug)).toEqual(['sitemap-post-here']);
      expect(data.projects.map((e: { slug: string }) => e.slug)).toEqual(['live-project']);
      expect(data.categories.map((e: { slug: string }) => e.slug)).toEqual(['engineering']);
      expect(data.tags.map((e: { slug: string }) => e.slug)).toEqual(['react']);
      expect(Date.parse(data.blogs[0].lastModified)).not.toBeNaN();
    });
  });
});
