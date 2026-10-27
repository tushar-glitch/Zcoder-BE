import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TestApp } from './support/test-app.js';

const text = (value: string, marks?: object[]) => ({ type: 'text', text: value, ...(marks && { marks }) });
const doc = (...content: object[]) => ({ type: 'doc', content });
const paragraph = (value: string) => ({ type: 'paragraph', content: [text(value)] });

describe('admin blogs', () => {
  let testApp: TestApp;
  const url = (suffix = '') => `/api/v1/admin/blogs${suffix}`;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  const createBlog = (body: object = {}) => testApp.admin.post(url()).send({ title: 'A fresh blog post', ...body });

  async function readyToPublish(overrides: object = {}) {
    const category = testApp.catalog.addCategory('Engineering');
    const author = testApp.catalog.addAuthor('Priya Sharma');
    const cover = await testApp.media.create({
      fileName: 'cover.png', altText: 'Cover', storageKey: '2026/10/cover', mimeType: 'image/webp', sizeBytes: 5, width: 1600, height: 800,
    });
    const response = await createBlog({
      excerpt: 'e'.repeat(80),
      seoDescription: 's'.repeat(100),
      categoryId: category.id,
      authorId: author.id,
      coverImageId: cover.id,
      contentJson: doc(paragraph('Some real content for the post')),
      ...overrides,
    }).expect(201);
    return { blog: response.body.data, category, author, cover };
  }

  it('requires an admin session', async () => {
    await testApp.anonymous().get(url()).expect(401);
    await testApp.anonymous().post(url()).send({ title: 'x' }).expect(401);
  });

  describe('creating a draft', () => {
    it('needs only a title and starts as a draft with a generated slug', async () => {
      const response = await createBlog({ title: 'Hello, World! 2026' }).expect(201);

      expect(response.body.data).toMatchObject({
        title: 'Hello, World! 2026',
        slug: 'hello-world-2026',
        status: 'DRAFT',
        publishedAt: null,
        category: null,
        author: null,
        tags: [],
        coverImage: null,
        contentHtml: null,
      });
      expect(testApp.audit.entries[0]).toMatchObject({ action: 'blog.create', entityType: 'blog' });
      expect(testApp.revalidated).toEqual([]);
    });

    it('does not enforce publish-time minimums on a draft', async () => {
      await createBlog({ title: 'Hi', excerpt: 'short', seoDescription: 'short' }).expect(201);
    });

    it('makes slugs unique and rejects an explicit duplicate', async () => {
      await createBlog({ title: 'My post' }).expect(201);

      expect((await createBlog({ title: 'My post' }).expect(201)).body.data.slug).toBe('my-post-2');
      await createBlog({ title: 'Other', slug: 'my-post' }).expect(409);
    });

    it('validates the input', async () => {
      await testApp.admin.post(url()).send({}).expect(400);
      await createBlog({ title: 'x'.repeat(121) }).expect(400);
      await createBlog({ slug: 'Not A Slug' }).expect(400);
      await createBlog({ excerpt: 'x'.repeat(301) }).expect(400);
      await createBlog({ seoTitle: 'x'.repeat(61) }).expect(400);
      await createBlog({ seoDescription: 'x'.repeat(161) }).expect(400);
      await createBlog({ categoryId: 'not-a-uuid' }).expect(400);
      await createBlog({ categoryId: null }).expect(400);
      await createBlog({ contentJson: 'plain string' }).expect(400);
    });

    it('limits tags to 10 unique ids', async () => {
      const ids = Array.from({ length: 11 }, () => testApp.catalog.addTag(`tag-${Math.random()}`).id);

      await createBlog({ tagIds: ids }).expect(400);
      await createBlog({ tagIds: [ids[0], ids[0]] }).expect(400);
      await createBlog({ tagIds: ids.slice(0, 10) }).expect(201);
    });

    it('rejects references to records that do not exist, naming each field', async () => {
      const missing = '6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11';

      const response = await createBlog({
        categoryId: missing,
        authorId: missing,
        coverImageId: missing,
        tagIds: [missing],
      }).expect(400);

      expect(response.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
        'authorId',
        'categoryId',
        'coverImageId',
        'tagIds',
      ]);
    });

    it('rejects a publishedAt in the future but accepts one in the past', async () => {
      await createBlog({ publishedAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(400);
      await createBlog({ publishedAt: '2024-01-15T10:00:00.000Z' }).expect(201);
    });
  });

  describe('content', () => {
    it('generates sanitised HTML and a reading time from contentJson', async () => {
      const response = await createBlog({ contentJson: doc({ type: 'heading', attrs: { level: 2 }, content: [text('Intro')] }, paragraph('<script>alert(1)</script>')) }).expect(201);

      expect(response.body.data.contentHtml).toBe('<h2>Intro</h2><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
      expect(response.body.data.contentJson.type).toBe('doc');
      expect(response.body.data.readingTimeMin).toBe(1);
    });

    it('refuses client-supplied HTML', async () => {
      const response = await createBlog({ contentHtml: '<p>hacked</p>' }).expect(400);

      expect(response.body.error.details[0].path).toBe('contentHtml');
    });

    it('reports unsupported content with its path', async () => {
      const response = await createBlog({
        contentJson: doc(paragraph('ok'), { type: 'iframe' }, { type: 'paragraph', content: [text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])] }),
      }).expect(400);

      expect(response.body.error.details.map((d: { path: string }) => d.path)).toEqual([
        'contentJson.content[1].type',
        'contentJson.content[2].content[0].marks[0].attrs.href',
      ]);
    });

    it('regenerates the HTML when the content changes', async () => {
      const blog = (await createBlog({ contentJson: doc(paragraph('first')) }).expect(201)).body.data;

      const response = await testApp.admin.patch(url(`/${blog.id}`)).send({ contentJson: doc(paragraph('second')) }).expect(200);

      expect(response.body.data.contentHtml).toBe('<p>second</p>');
    });
  });

  describe('slug-available', () => {
    it('reports a free slug', async () => {
      const response = await testApp.admin.get(url('/slug-available?slug=brand-new')).expect(200);

      expect(response.body.data).toEqual({ available: true, suggestion: null });
    });

    it('suggests an alternative for a taken or malformed slug', async () => {
      const blog = (await createBlog({ title: 'Taken slug' }).expect(201)).body.data;

      const taken = await testApp.admin.get(url(`/slug-available?slug=${blog.slug}`)).expect(200);
      const malformed = await testApp.admin.get(url('/slug-available?slug=Not%20Valid!')).expect(200);

      expect(taken.body.data).toEqual({ available: false, suggestion: 'taken-slug-2' });
      expect(malformed.body.data).toEqual({ available: false, suggestion: 'not-valid' });
    });

    it('treats the blog being edited as free', async () => {
      const blog = (await createBlog({ title: 'Mine' }).expect(201)).body.data;

      const response = await testApp.admin.get(url(`/slug-available?slug=mine&excludeId=${blog.id}`)).expect(200);

      expect(response.body.data.available).toBe(true);
    });
  });

  describe('publishing', () => {
    it('lists every missing requirement at once', async () => {
      const blog = (await createBlog({ title: 'Hi' }).expect(201)).body.data;

      const response = await testApp.admin.post(url(`/${blog.id}/publish`)).expect(400);

      expect(response.body.error.details.map((d: { path: string }) => d.path)).toEqual([
        'title',
        'excerpt',
        'contentJson',
        'categoryId',
        'authorId',
        'coverImageId',
        'seoDescription',
      ]);
    });

    it('publishes a complete blog, stamps publishedAt and revalidates the site', async () => {
      const { blog } = await readyToPublish();

      const response = await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200);

      expect(response.body.data.status).toBe('PUBLISHED');
      expect(new Date(response.body.data.publishedAt).getTime()).toBeGreaterThan(Date.now() - 5000);
      expect(testApp.revalidated).toEqual([['blogs', `blog:${blog.slug}`]]);
      expect(testApp.audit.entries.at(-1)).toMatchObject({ action: 'blog.publish', entityId: blog.id });
    });

    it('keeps a backdated publishedAt', async () => {
      const { blog } = await readyToPublish({ publishedAt: '2024-01-15T10:00:00.000Z' });

      const response = await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200);

      expect(response.body.data.publishedAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('refuses to publish twice', async () => {
      const { blog } = await readyToPublish();
      await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200);

      const response = await testApp.admin.post(url(`/${blog.id}/publish`)).expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('unpublishes back to draft, keeps the first publish date, and republishes with it', async () => {
      const { blog } = await readyToPublish();
      const published = (await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200)).body.data;

      const draft = (await testApp.admin.post(url(`/${blog.id}/unpublish`)).expect(200)).body.data;
      const republished = (await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200)).body.data;

      expect(draft.status).toBe('DRAFT');
      expect(draft.publishedAt).toBe(published.publishedAt);
      expect(republished.publishedAt).toBe(published.publishedAt);
    });

    it('refuses to unpublish a draft', async () => {
      const blog = (await createBlog().expect(201)).body.data;

      await testApp.admin.post(url(`/${blog.id}/unpublish`)).expect(409);
    });

    it('returns 404 for an unknown blog', async () => {
      await testApp.admin.post(url('/6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11/publish')).expect(404);
    });
  });

  describe('editing', () => {
    it('updates only the fields that are sent', async () => {
      const blog = (await createBlog({ excerpt: 'Keep this excerpt' }).expect(201)).body.data;

      const response = await testApp.admin.patch(url(`/${blog.id}`)).send({ title: 'Renamed post' }).expect(200);

      expect(response.body.data).toMatchObject({ title: 'Renamed post', excerpt: 'Keep this excerpt', slug: blog.slug });
    });

    it('replaces tags and can clear the cover image', async () => {
      const first = testApp.catalog.addTag('first');
      const second = testApp.catalog.addTag('second');
      const { blog } = await readyToPublish({ tagIds: [first.id] });

      const response = await testApp.admin.patch(url(`/${blog.id}`)).send({ tagIds: [second.id], coverImageId: null }).expect(200);

      expect(response.body.data.tags.map((t: { name: string }) => t.name)).toEqual(['second']);
      expect(response.body.data.coverImage).toBeNull();
    });

    it('does not let an edit break a published blog and revalidates a valid edit', async () => {
      const { blog } = await readyToPublish();
      await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200);
      testApp.revalidated.length = 0;

      const rejected = await testApp.admin.patch(url(`/${blog.id}`)).send({ coverImageId: null, excerpt: 'too short' }).expect(400);
      await testApp.admin.patch(url(`/${blog.id}`)).send({ title: 'A still valid title' }).expect(200);

      expect(rejected.body.error.details.map((d: { path: string }) => d.path)).toEqual(['excerpt', 'coverImageId']);
      expect(testApp.revalidated).toEqual([['blogs', `blog:${blog.slug}`]]);
    });

    it('keeps the old slug as a redirect once a blog has been published', async () => {
      const { blog } = await readyToPublish({ title: 'Original title' });
      await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200);
      testApp.revalidated.length = 0;

      const renamed = await testApp.admin.patch(url(`/${blog.id}`)).send({ slug: 'new-slug' }).expect(200);

      expect(renamed.body.data.slug).toBe('new-slug');
      expect(testApp.catalog.history).toEqual([{ blogId: blog.id, slug: 'original-title' }]);
      expect(testApp.revalidated).toEqual([['blogs', 'blog:new-slug', 'blog:original-title']]);
      await createBlog({ title: 'Squatter', slug: 'original-title' }).expect(409);
      expect((await testApp.admin.get(url('/slug-available?slug=original-title'))).body.data.available).toBe(false);
    });

    it('lets a blog take back its own old slug', async () => {
      const { blog } = await readyToPublish({ title: 'Original title' });
      await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200);
      await testApp.admin.patch(url(`/${blog.id}`)).send({ slug: 'new-slug' }).expect(200);

      await testApp.admin.patch(url(`/${blog.id}`)).send({ slug: 'original-title' }).expect(200);

      expect(testApp.catalog.history).toEqual([{ blogId: blog.id, slug: 'new-slug' }]);
    });

    it('does not keep a redirect for a blog that was never published', async () => {
      const blog = (await createBlog({ title: 'Never live' }).expect(201)).body.data;

      await testApp.admin.patch(url(`/${blog.id}`)).send({ slug: 'renamed' }).expect(200);

      expect(testApp.catalog.history).toEqual([]);
    });

    it('rejects a taken slug', async () => {
      await createBlog({ title: 'One' }).expect(201);
      const two = (await createBlog({ title: 'Two' }).expect(201)).body.data;

      await testApp.admin.patch(url(`/${two.id}`)).send({ slug: 'one' }).expect(409);
    });
  });

  describe('deleting', () => {
    it('deletes a draft', async () => {
      const blog = (await createBlog().expect(201)).body.data;

      await testApp.admin.delete(url(`/${blog.id}`)).expect(204);
      await testApp.admin.get(url(`/${blog.id}`)).expect(404);
    });

    it('refuses to delete a published blog', async () => {
      const { blog } = await readyToPublish();
      await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200);

      await testApp.admin.delete(url(`/${blog.id}`)).expect(409);
    });
  });

  describe('listing and reading', () => {
    it('filters, searches and paginates', async () => {
      const { blog, category } = await readyToPublish({ title: 'Published about APIs' });
      await testApp.admin.post(url(`/${blog.id}/publish`)).expect(200);
      await createBlog({ title: 'Draft about design' }).expect(201);
      await createBlog({ title: 'Another draft' }).expect(201);

      const drafts = await testApp.admin.get(url('?status=DRAFT')).expect(200);
      const search = await testApp.admin.get(url('?q=APIs')).expect(200);
      const byCategory = await testApp.admin.get(url(`?categoryId=${category.id}`)).expect(200);
      const paged = await testApp.admin.get(url('?pageSize=2&sort=title:asc')).expect(200);

      expect(drafts.body.data).toHaveLength(2);
      expect(search.body.data.map((b: { title: string }) => b.title)).toEqual(['Published about APIs']);
      expect(byCategory.body.data).toHaveLength(1);
      expect(paged.body.data.map((b: { title: string }) => b.title)).toEqual(['Another draft', 'Draft about design']);
      expect(paged.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    });

    it('returns the row shape in lists and the full shape for one blog', async () => {
      const { blog } = await readyToPublish();

      const list = await testApp.admin.get(url()).expect(200);
      const single = await testApp.admin.get(url(`/${blog.id}`)).expect(200);

      expect(list.body.data[0]).not.toHaveProperty('contentJson');
      expect(list.body.data[0].author).toMatchObject({ name: 'Priya Sharma' });
      expect(single.body.data).toMatchObject({ id: blog.id, readingTimeMin: 1 });
      expect(single.body.data.coverImage.variants.thumbnailUrl).toMatch(/-320\.webp$/);
    });

    it('rejects bad query values', async () => {
      await testApp.admin.get(url('?status=ARCHIVED')).expect(400);
      await testApp.admin.get(url('?sort=contentHtml:asc')).expect(400);
      await testApp.admin.get(url('?pageSize=101')).expect(400);
      await testApp.admin.get(url('?categoryId=nope')).expect(400);
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      await testApp.admin.get(url('/6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11')).expect(404);
      await testApp.admin.get(url('/not-a-uuid')).expect(400);
    });
  });

  describe('preview', () => {
    it('renders a draft in the public shape with HTML by default', async () => {
      const { blog } = await readyToPublish({ title: 'Preview me', seoTitle: undefined });

      const response = await testApp.admin.get(url(`/${blog.id}/preview`)).expect(200);

      expect(response.body.data.contentHtml).toBe('<p>Some real content for the post</p>');
      expect(response.body.data).not.toHaveProperty('contentJson');
      expect(response.body.data).not.toHaveProperty('status');
      expect(response.body.data.seoTitle).toBe('Preview me');
      expect(response.body.data.tags).toEqual([]);
    });

    it('returns the JSON document instead when asked', async () => {
      const { blog } = await readyToPublish();

      const response = await testApp.admin.get(url(`/${blog.id}/preview?format=json`)).expect(200);

      expect(response.body.data.contentJson.type).toBe('doc');
      expect(response.body.data).not.toHaveProperty('contentHtml');
      await testApp.admin.get(url(`/${blog.id}/preview?format=xml`)).expect(400);
    });
  });
});
