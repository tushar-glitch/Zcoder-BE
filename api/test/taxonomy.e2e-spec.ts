import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TestApp } from './support/test-app.js';

describe.each([
  { resource: 'categories', entity: 'category', label: 'Category' },
  { resource: 'tags', entity: 'tag', label: 'Tag' },
])('admin $resource', ({ resource, entity }) => {
  let testApp: TestApp;
  const url = (suffix = '') => `/api/v1/admin/${resource}${suffix}`;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  const create = (body: object) => testApp.admin.post(url()).send(body);

  it('requires an admin session', async () => {
    await testApp.anonymous().get(url()).expect(401);
    await testApp.anonymous().post(url()).send({ name: 'X' }).expect(401);
  });

  it('creates an item with a generated slug and a zero post count', async () => {
    const response = await create({ name: 'Web Development', description: 'All about the web' }).expect(201);

    expect(response.body.data).toMatchObject({
      name: 'Web Development',
      slug: 'web-development',
      description: 'All about the web',
      postCount: 0,
    });
  });

  it('records an audit entry and asks the site to revalidate', async () => {
    const created = (await create({ name: 'Audited' }).expect(201)).body.data;

    expect(testApp.audit.entries).toMatchObject([{ action: `${entity}.create`, entityType: entity, entityId: created.id }]);
    expect(testApp.revalidated).toEqual([['blogs']]);
  });

  it('makes generated slugs unique', async () => {
    await create({ name: 'News!' }).expect(201);

    const second = await create({ name: 'News' }).expect(201);

    expect(second.body.data.slug).toBe('news-2');
  });

  it('rejects a duplicate name regardless of case, and a duplicate explicit slug', async () => {
    await create({ name: 'Design', slug: 'design' }).expect(201);

    await create({ name: 'DESIGN' }).expect(409);
    await create({ name: 'Other', slug: 'design' }).expect(409);
  });

  it('validates the input', async () => {
    await create({}).expect(400);
    await create({ name: '' }).expect(400);
    await create({ name: 'x'.repeat(61) }).expect(400);
    await create({ name: 'Ok', slug: 'Not A Slug' }).expect(400);
    await create({ name: 'Ok', description: 'x'.repeat(301) }).expect(400);
    const unknown = await create({ name: 'Ok', isAdmin: true }).expect(400);
    expect(unknown.body.error.details[0].path).toBe('isAdmin');
  });

  it('trims the name', async () => {
    expect((await create({ name: '  Spaced  ' }).expect(201)).body.data.name).toBe('Spaced');
  });

  it('lists items alphabetically', async () => {
    await create({ name: 'Zebra' });
    await create({ name: 'Apple' });

    const response = await testApp.admin.get(url()).expect(200);

    expect(response.body.data.map((item: { name: string }) => item.name)).toEqual(['Apple', 'Zebra']);
    expect(response.body.meta).toBeUndefined();
  });

  it('updates only the fields that are sent', async () => {
    const created = (await create({ name: 'Original', description: 'Keep me' }).expect(201)).body.data;

    const response = await testApp.admin.patch(url(`/${created.id}`)).send({ name: 'Renamed' }).expect(200);

    expect(response.body.data).toMatchObject({ name: 'Renamed', slug: 'original', description: 'Keep me' });
  });

  it('rejects renaming to an existing name or slug but allows keeping its own', async () => {
    await create({ name: 'First' });
    const second = (await create({ name: 'Second' }).expect(201)).body.data;

    await testApp.admin.patch(url(`/${second.id}`)).send({ name: 'first' }).expect(409);
    await testApp.admin.patch(url(`/${second.id}`)).send({ slug: 'first' }).expect(409);
    await testApp.admin.patch(url(`/${second.id}`)).send({ name: 'Second', slug: 'second' }).expect(200);
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    await testApp.admin.patch(url('/6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11')).send({ name: 'X' }).expect(404);
    await testApp.admin.delete(url('/6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11')).expect(404);
    await testApp.admin.patch(url('/nope')).send({ name: 'X' }).expect(400);
  });

  it('deletes an unused item', async () => {
    const created = (await create({ name: 'Disposable' }).expect(201)).body.data;

    await testApp.admin.delete(url(`/${created.id}`)).expect(204);

    expect((await testApp.admin.get(url())).body.data).toEqual([]);
  });
});

describe('categories and tags that are in use', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  const blogWith = async (extra: object) => {
    const response = await testApp.admin.post('/api/v1/admin/blogs').send({ title: 'A blog post', ...extra });
    expect(response.status).toBe(201);
    return response.body.data;
  };

  it('counts posts and refuses to delete a category that has them', async () => {
    const category = (await testApp.admin.post('/api/v1/admin/categories').send({ name: 'Engineering' })).body.data;
    await blogWith({ categoryId: category.id });

    const list = await testApp.admin.get('/api/v1/admin/categories').expect(200);
    const refusal = await testApp.admin.delete(`/api/v1/admin/categories/${category.id}`).expect(409);

    expect(list.body.data[0].postCount).toBe(1);
    expect(refusal.body.error.code).toBe('CONFLICT');
  });

  it('detaches a deleted tag from its posts', async () => {
    const tag = (await testApp.admin.post('/api/v1/admin/tags').send({ name: 'nestjs' })).body.data;
    const blog = await blogWith({ tagIds: [tag.id] });

    await testApp.admin.delete(`/api/v1/admin/tags/${tag.id}`).expect(204);

    const reloaded = await testApp.admin.get(`/api/v1/admin/blogs/${blog.id}`).expect(200);
    expect(reloaded.body.data.tags).toEqual([]);
  });
});

describe('admin authors', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  const create = (body: object) => testApp.admin.post('/api/v1/admin/authors').send(body);
  const sampleMedia = () =>
    testApp.media.create({
      fileName: 'a.png',
      altText: 'Portrait',
      storageKey: '2026/10/abc',
      mimeType: 'image/webp',
      sizeBytes: 10,
      width: 400,
      height: 400,
    });

  it('creates an author with a generated slug and an optional avatar', async () => {
    const avatar = await sampleMedia();

    const response = await create({ name: 'Priya Sharma', bio: 'Writes about APIs', avatarId: avatar.id }).expect(201);

    expect(response.body.data).toMatchObject({ name: 'Priya Sharma', slug: 'priya-sharma', bio: 'Writes about APIs' });
    expect(response.body.data.avatar).toMatchObject({ id: avatar.id, altText: 'Portrait' });
    expect(testApp.audit.entries[0]).toMatchObject({ action: 'author.create', entityType: 'author' });
  });

  it('allows two authors with the same name and gives them distinct slugs', async () => {
    await create({ name: 'Sam Lee' }).expect(201);

    expect((await create({ name: 'Sam Lee' }).expect(201)).body.data.slug).toBe('sam-lee-2');
  });

  it('rejects an avatar that does not exist', async () => {
    const response = await create({ name: 'No Avatar', avatarId: '6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11' }).expect(400);

    expect(response.body.error.details).toEqual([
      { path: 'avatarId', message: 'avatarId does not match any media' },
    ]);
  });

  it('validates name, bio and slug', async () => {
    await create({}).expect(400);
    await create({ name: 'x'.repeat(81) }).expect(400);
    await create({ name: 'Ok', bio: 'x'.repeat(501) }).expect(400);
    await create({ name: 'Ok', slug: 'Bad Slug' }).expect(400);
  });

  it('updates, clears the avatar, and refuses a taken slug', async () => {
    const avatar = await sampleMedia();
    const first = (await create({ name: 'First Author', avatarId: avatar.id }).expect(201)).body.data;
    const second = (await create({ name: 'Second Author' }).expect(201)).body.data;

    const cleared = await testApp.admin.patch(`/api/v1/admin/authors/${first.id}`).send({ avatarId: null, bio: 'New bio' }).expect(200);
    await testApp.admin.patch(`/api/v1/admin/authors/${second.id}`).send({ slug: first.slug }).expect(409);

    expect(cleared.body.data).toMatchObject({ avatar: null, bio: 'New bio' });
  });

  it('refuses to delete an author linked to blogs', async () => {
    const author = (await create({ name: 'Linked Author' }).expect(201)).body.data;
    await testApp.admin.post('/api/v1/admin/blogs').send({ title: 'Linked post', authorId: author.id }).expect(201);

    await testApp.admin.delete(`/api/v1/admin/authors/${author.id}`).expect(409);
  });

  it('deletes an unlinked author', async () => {
    const author = (await create({ name: 'Free Author' }).expect(201)).body.data;

    await testApp.admin.delete(`/api/v1/admin/authors/${author.id}`).expect(204);
  });

  it('refuses to delete an avatar that an author still uses', async () => {
    const avatar = await sampleMedia();
    await create({ name: 'Has Avatar', avatarId: avatar.id }).expect(201);
    testApp.media.inUse.add(avatar.id);

    await testApp.admin.delete(`/api/v1/admin/media/${avatar.id}`).expect(409);
  });
});
