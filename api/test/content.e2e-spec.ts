import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TestApp } from './support/test-app.js';

const QUOTE = 'Working with ZoyCoders was a great experience from start to finish.';
const MISSING_ID = '6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11';

const resources = [
  { path: 'services', entity: 'service', tag: 'services', body: { title: 'Web Development' }, field: 'title', changed: { title: 'Renamed' } },
  { path: 'projects', entity: 'project', tag: 'projects', body: { title: 'Customer Portal' }, field: 'title', changed: { title: 'Renamed' } },
  { path: 'testimonials', entity: 'testimonial', tag: 'testimonials', body: { clientName: 'Priya Sharma', quote: QUOTE }, field: 'clientName', changed: { clientName: 'Renamed' } },
  { path: 'faqs', entity: 'faq', tag: 'faqs', body: { question: 'How long does it take?', answer: 'About six weeks.' }, field: 'question', changed: { question: 'Renamed?' } },
];

describe.each(resources)('admin $path (shared behaviour)', ({ path, entity, tag, body, field, changed }) => {
  let testApp: TestApp;
  const url = (suffix = '') => `/api/v1/admin/${path}${suffix}`;
  const items = async () => (await testApp.admin.get(url()).expect(200)).body.data;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  it('requires an admin session', async () => {
    await testApp.anonymous().get(url()).expect(401);
    await testApp.anonymous().post(url()).send(body).expect(401);
    await testApp.anonymous().delete(url(`/${MISSING_ID}`)).expect(401);
  });

  it('creates an unpublished item, audits it and asks the site to revalidate', async () => {
    const response = await testApp.admin.post(url()).send(body).expect(201);

    expect(response.body.data).toMatchObject({ ...body, isPublished: false, sortOrder: 0 });
    expect(testApp.audit.entries).toMatchObject([{ action: `${entity}.create`, entityType: entity, entityId: response.body.data.id }]);
    expect(testApp.revalidated[0]).toContain(tag);
  });

  it('appends new items to the end and lists them by sortOrder', async () => {
    await testApp.admin.post(url()).send({ ...body, [field]: `${body[field as keyof typeof body]} A` }).expect(201);
    await testApp.admin.post(url()).send({ ...body, [field]: `${body[field as keyof typeof body]} B`, sortOrder: 10 }).expect(201);
    await testApp.admin.post(url()).send({ ...body, [field]: `${body[field as keyof typeof body]} C` }).expect(201);

    expect((await items()).map((item: { sortOrder: number }) => item.sortOrder)).toEqual([0, 10, 11]);
  });

  it('reorders by changing sortOrder', async () => {
    const first = (await testApp.admin.post(url()).send(body).expect(201)).body.data;
    await testApp.admin.post(url()).send({ ...body, [field]: 'Second item' }).expect(201);

    await testApp.admin.patch(url(`/${first.id}`)).send({ sortOrder: 5 }).expect(200);

    expect((await items()).map((item: { id: string }) => item.id)[1]).toBe(first.id);
  });

  it('updates only the fields that are sent and revalidates', async () => {
    const created = (await testApp.admin.post(url()).send(body).expect(201)).body.data;
    testApp.revalidated.length = 0;

    const response = await testApp.admin.patch(url(`/${created.id}`)).send(changed).expect(200);

    expect(response.body.data).toMatchObject({ ...changed, sortOrder: 0 });
    expect(testApp.audit.entries.at(-1)).toMatchObject({ action: `${entity}.update`, entityId: created.id });
    expect(testApp.revalidated[0]).toContain(tag);
  });

  it('treats a null for a required field as "no change"', async () => {
    const created = (await testApp.admin.post(url()).send(body).expect(201)).body.data;

    const response = await testApp.admin.patch(url(`/${created.id}`)).send({ [field]: null, isPublished: null }).expect(200);

    expect(response.body.data[field]).toBe(created[field]);
    expect(response.body.data.isPublished).toBe(false);
  });

  it('gets one item and rejects unknown or malformed ids', async () => {
    const created = (await testApp.admin.post(url()).send(body).expect(201)).body.data;

    expect((await testApp.admin.get(url(`/${created.id}`)).expect(200)).body.data.id).toBe(created.id);
    await testApp.admin.get(url(`/${MISSING_ID}`)).expect(404);
    await testApp.admin.get(url('/not-a-uuid')).expect(400);
    await testApp.admin.patch(url(`/${MISSING_ID}`)).send(changed).expect(404);
  });

  it('rejects unknown fields, a missing required field and a negative sortOrder', async () => {
    const unknown = await testApp.admin.post(url()).send({ ...body, isAdmin: true }).expect(400);

    expect(unknown.body.error.details[0].path).toBe('isAdmin');
    await testApp.admin.post(url()).send({}).expect(400);
    await testApp.admin.post(url()).send({ ...body, sortOrder: -1 }).expect(400);
    await testApp.admin.post(url()).send({ ...body, isPublished: 'yes' }).expect(400);
  });

  it('deletes an item', async () => {
    const created = (await testApp.admin.post(url()).send(body).expect(201)).body.data;
    testApp.revalidated.length = 0;

    await testApp.admin.delete(url(`/${created.id}`)).expect(204);

    expect(await items()).toEqual([]);
    expect(testApp.audit.entries.at(-1)).toMatchObject({ action: `${entity}.delete`, entityId: created.id });
    expect(testApp.revalidated[0]).toContain(tag);
    await testApp.admin.delete(url(`/${created.id}`)).expect(404);
  });
});

describe('admin services', () => {
  let testApp: TestApp;
  const create = (body: object) => testApp.admin.post('/api/v1/admin/services').send(body);

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  it('generates unique slugs and rejects a duplicate explicit slug', async () => {
    expect((await create({ title: 'Web App' }).expect(201)).body.data.slug).toBe('web-app');
    expect((await create({ title: 'Web App' }).expect(201)).body.data.slug).toBe('web-app-2');
    await create({ title: 'Other', slug: 'web-app' }).expect(409);
  });

  it('keeps the slug when the title changes and accepts a free new slug', async () => {
    const service = (await create({ title: 'Original' }).expect(201)).body.data;

    const renamed = await testApp.admin.patch(`/api/v1/admin/services/${service.id}`).send({ title: 'New title' }).expect(200);
    const reslugged = await testApp.admin.patch(`/api/v1/admin/services/${service.id}`).send({ slug: 'custom' }).expect(200);

    expect(renamed.body.data.slug).toBe('original');
    expect(reslugged.body.data.slug).toBe('custom');
  });

  it('refuses a slug that belongs to another service but allows keeping its own', async () => {
    await create({ title: 'One' }).expect(201);
    const two = (await create({ title: 'Two' }).expect(201)).body.data;

    await testApp.admin.patch(`/api/v1/admin/services/${two.id}`).send({ slug: 'one' }).expect(409);
    await testApp.admin.patch(`/api/v1/admin/services/${two.id}`).send({ slug: 'two' }).expect(200);
  });

  it('stores technologies, SEO fields and an OG image', async () => {
    const image = await testApp.media.create({ fileName: 'og.png', altText: 'OG', storageKey: '2026/10/og', mimeType: 'image/webp', sizeBytes: 1, width: 1200, height: 630 });

    const response = await create({
      title: 'API Development',
      icon: 'code',
      shortDescription: 'Robust APIs',
      description: 'Line one.\n\nLine two.',
      technologies: ['NestJS', 'PostgreSQL'],
      seoTitle: 'API Development | ZoyCoders',
      seoDescription: 'We build APIs.',
      ogImageId: image.id,
    }).expect(201);

    expect(response.body.data).toMatchObject({
      icon: 'code',
      description: 'Line one.\n\nLine two.',
      technologies: ['NestJS', 'PostgreSQL'],
      seoTitle: 'API Development | ZoyCoders',
    });
    expect(response.body.data.ogImage.id).toBe(image.id);
  });

  it('validates the fields', async () => {
    await create({ title: 'x'.repeat(101) }).expect(400);
    await create({ title: 'Ok', icon: 'x'.repeat(41) }).expect(400);
    await create({ title: 'Ok', shortDescription: 'x'.repeat(201) }).expect(400);
    await create({ title: 'Ok', technologies: Array.from({ length: 21 }, (_, i) => `t${i}`) }).expect(400);
    await create({ title: 'Ok', technologies: ['dup', 'dup'] }).expect(400);
    await create({ title: 'Ok', technologies: ['x'.repeat(41)] }).expect(400);
    await create({ title: 'Ok', slug: 'Bad Slug' }).expect(400);
    await create({ title: 'Ok', seoTitle: 'x'.repeat(61) }).expect(400);
  });

  it('rejects an OG image that does not exist', async () => {
    const response = await create({ title: 'Ok', ogImageId: MISSING_ID }).expect(400);

    expect(response.body.error.details).toEqual([{ path: 'ogImageId', message: 'ogImageId does not match any media' }]);
  });

  it('keeps at least one service published', async () => {
    const only = (await create({ title: 'Only', isPublished: true }).expect(201)).body.data;
    const draft = (await create({ title: 'Draft' }).expect(201)).body.data;

    await testApp.admin.patch(`/api/v1/admin/services/${only.id}`).send({ isPublished: false }).expect(409);
    await testApp.admin.delete(`/api/v1/admin/services/${only.id}`).expect(409);
    await testApp.admin.delete(`/api/v1/admin/services/${draft.id}`).expect(204);

    const second = (await create({ title: 'Second', isPublished: true }).expect(201)).body.data;
    await testApp.admin.patch(`/api/v1/admin/services/${only.id}`).send({ isPublished: false }).expect(200);
    await testApp.admin.patch(`/api/v1/admin/services/${second.id}`).send({ isPublished: false }).expect(409);
  });
});

describe('admin projects', () => {
  let testApp: TestApp;
  const url = (suffix = '') => `/api/v1/admin/projects${suffix}`;
  const create = (body: object) => testApp.admin.post(url()).send(body);
  const image = (name: string) =>
    testApp.media.create({ fileName: `${name}.png`, altText: name, storageKey: `2026/10/${name}`, mimeType: 'image/webp', sizeBytes: 1, width: 800, height: 600 });

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  it('stores links, client, featured flag, cover and an ordered gallery', async () => {
    const [cover, first, second] = await Promise.all([image('cover'), image('first'), image('second')]);

    const response = await create({
      title: 'Customer Portal',
      summary: 'A portal',
      description: 'Plain text',
      technologies: ['Next.js'],
      coverImageId: cover.id,
      galleryImageIds: [second.id, first.id],
      demoUrl: 'https://demo.example.com',
      sourceUrl: 'http://git.example.com/repo',
      clientName: 'Acme Pvt Ltd',
      isFeatured: true,
    }).expect(201);

    expect(response.body.data).toMatchObject({
      slug: 'customer-portal',
      demoUrl: 'https://demo.example.com',
      clientName: 'Acme Pvt Ltd',
      isFeatured: true,
    });
    expect(response.body.data.coverImage.id).toBe(cover.id);
    expect(response.body.data.gallery.map((g: { image: { id: string }; sortOrder: number }) => [g.image.id, g.sortOrder])).toEqual([
      [second.id, 0],
      [first.id, 1],
    ]);
  });

  it('replaces the gallery on update and leaves it alone otherwise', async () => {
    const [a, b] = await Promise.all([image('a'), image('b')]);
    const project = (await create({ title: 'Gallery', galleryImageIds: [a.id] }).expect(201)).body.data;

    const untouched = await testApp.admin.patch(url(`/${project.id}`)).send({ summary: 'Changed' }).expect(200);
    const replaced = await testApp.admin.patch(url(`/${project.id}`)).send({ galleryImageIds: [b.id] }).expect(200);
    const emptied = await testApp.admin.patch(url(`/${project.id}`)).send({ galleryImageIds: [] }).expect(200);

    expect(untouched.body.data.gallery).toHaveLength(1);
    expect(replaced.body.data.gallery.map((g: { image: { id: string } }) => g.image.id)).toEqual([b.id]);
    expect(emptied.body.data.gallery).toEqual([]);
  });

  it('names every media reference that does not exist', async () => {
    const response = await create({ title: 'Broken', coverImageId: MISSING_ID, ogImageId: MISSING_ID, galleryImageIds: [MISSING_ID] }).expect(400);

    expect(response.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['coverImageId', 'galleryImageIds', 'ogImageId']);
  });

  it('only accepts http(s) links and lets them be cleared', async () => {
    await create({ title: 'Bad', demoUrl: 'javascript:alert(1)' }).expect(400);
    await create({ title: 'Bad', sourceUrl: 'ftp://files.example.com' }).expect(400);
    await create({ title: 'Bad', demoUrl: 'not a url' }).expect(400);
    const project = (await create({ title: 'Linked', demoUrl: 'https://demo.example.com' }).expect(201)).body.data;

    const cleared = await testApp.admin.patch(url(`/${project.id}`)).send({ demoUrl: null }).expect(200);

    expect(cleared.body.data.demoUrl).toBeNull();
  });

  it('limits the gallery to 20 unique images', async () => {
    const ids = Array.from({ length: 21 }, () => MISSING_ID);

    await create({ title: 'Too many', galleryImageIds: ids }).expect(400);
    await create({ title: 'Dupes', galleryImageIds: [MISSING_ID, MISSING_ID] }).expect(400);
  });

  it('stamps publishedAt on the first publish only', async () => {
    const draft = (await create({ title: 'Draft' }).expect(201)).body.data;
    const live = (await create({ title: 'Live', isPublished: true }).expect(201)).body.data;

    const republished = await testApp.admin.patch(url(`/${live.id}`)).send({ isPublished: false }).expect(200);
    const again = await testApp.admin.patch(url(`/${live.id}`)).send({ isPublished: true }).expect(200);

    expect(draft.publishedAt).toBeNull();
    expect(live.publishedAt).not.toBeNull();
    expect(republished.body.data.publishedAt).toBe(live.publishedAt);
    expect(again.body.data.publishedAt).toBe(live.publishedAt);
  });

  it('generates unique slugs and rejects a taken one', async () => {
    await create({ title: 'Same name' }).expect(201);

    expect((await create({ title: 'Same name' }).expect(201)).body.data.slug).toBe('same-name-2');
    await create({ title: 'Other', slug: 'same-name' }).expect(409);
  });

  it('lists with filters, search, sorting and pagination meta', async () => {
    await create({ title: 'Alpha portal', isPublished: true }).expect(201);
    await create({ title: 'Beta dashboard' }).expect(201);
    await create({ title: 'Gamma portal', summary: 'Mentions dashboard' }).expect(201);

    const published = await testApp.admin.get(url('?published=true')).expect(200);
    const drafts = await testApp.admin.get(url('?published=false')).expect(200);
    const search = await testApp.admin.get(url('?q=DASHBOARD&sort=title:desc')).expect(200);
    const paged = await testApp.admin.get(url('?pageSize=2&page=2')).expect(200);

    expect(published.body.data.map((p: { title: string }) => p.title)).toEqual(['Alpha portal']);
    expect(drafts.body.data).toHaveLength(2);
    expect(search.body.data.map((p: { title: string }) => p.title)).toEqual(['Gamma portal', 'Beta dashboard']);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    await testApp.admin.get(url('?published=maybe')).expect(400);
    await testApp.admin.get(url('?sort=clientName:asc')).expect(400);
  });
});

describe('admin testimonials', () => {
  let testApp: TestApp;
  const url = (suffix = '') => `/api/v1/admin/testimonials${suffix}`;
  const create = (body: object) => testApp.admin.post(url()).send({ clientName: 'Priya Sharma', quote: QUOTE, ...body });

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  it('cannot be published until the client has approved it', async () => {
    const response = await create({ isPublished: true }).expect(400);
    const draft = (await create({}).expect(201)).body.data;

    expect(response.body.error.details).toEqual([
      { path: 'clientApproved', message: 'clientApproved must be true before a testimonial can be published' },
    ]);
    await testApp.admin.patch(url(`/${draft.id}`)).send({ isPublished: true }).expect(400);
    const approved = await testApp.admin.patch(url(`/${draft.id}`)).send({ clientApproved: true, isPublished: true }).expect(200);
    expect(approved.body.data).toMatchObject({ clientApproved: true, isPublished: true });
  });

  it('cannot withdraw approval while published', async () => {
    const live = (await create({ clientApproved: true, isPublished: true }).expect(201)).body.data;

    await testApp.admin.patch(url(`/${live.id}`)).send({ clientApproved: false }).expect(400);
    await testApp.admin.patch(url(`/${live.id}`)).send({ clientApproved: false, isPublished: false }).expect(200);
  });

  it('validates the quote length, rating and optional fields', async () => {
    await create({ quote: 'too short' }).expect(400);
    await create({ quote: 'x'.repeat(601) }).expect(400);
    await create({ rating: 0 }).expect(400);
    await create({ rating: 6 }).expect(400);
    await create({ rating: 4.5 }).expect(400);
    await create({ clientName: 'x'.repeat(81) }).expect(400);
    await create({ company: 'x'.repeat(81) }).expect(400);
    expect((await create({ rating: 5, clientRole: 'CTO', company: 'Acme' }).expect(201)).body.data).toMatchObject({
      rating: 5,
      clientRole: 'CTO',
      company: 'Acme',
    });
  });

  it('attaches an avatar and rejects one that does not exist', async () => {
    const avatar = await testApp.media.create({ fileName: 'a.png', altText: 'Avatar', storageKey: '2026/10/av', mimeType: 'image/webp', sizeBytes: 1, width: 200, height: 200 });

    const created = await create({ avatarId: avatar.id }).expect(201);
    const missing = await create({ avatarId: MISSING_ID }).expect(400);

    expect(created.body.data.avatar.id).toBe(avatar.id);
    expect(missing.body.error.details[0].path).toBe('avatarId');
  });
});

describe('admin faqs', () => {
  let testApp: TestApp;
  const url = (suffix = '') => `/api/v1/admin/faqs${suffix}`;
  const create = (body: object = {}) => testApp.admin.post(url()).send({ question: 'A question?', answer: 'An answer.', ...body });

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  it('stores a group and the home flag', async () => {
    const response = await create({ group: 'Pricing', showOnHome: true }).expect(201);

    expect(response.body.data).toMatchObject({ group: 'Pricing', showOnHome: true, isPublished: false });
  });

  it('allows at most six FAQs on the home page', async () => {
    for (let index = 0; index < 6; index++) {
      await create({ question: `Home ${index}?`, showOnHome: true }).expect(201);
    }
    const extra = (await create({ question: 'Not on home?' }).expect(201)).body.data;

    const refusedCreate = await create({ showOnHome: true }).expect(409);
    await testApp.admin.patch(url(`/${extra.id}`)).send({ showOnHome: true }).expect(409);

    expect(refusedCreate.body.error.code).toBe('CONFLICT');
  });

  it('lets an FAQ already on the home page be edited when the home page is full', async () => {
    const ids: string[] = [];
    for (let index = 0; index < 6; index++) {
      ids.push((await create({ question: `Home ${index}?`, showOnHome: true }).expect(201)).body.data.id);
    }

    await testApp.admin.patch(url(`/${ids[0]}`)).send({ showOnHome: true, answer: 'Edited' }).expect(200);
    await testApp.admin.patch(url(`/${ids[0]}`)).send({ showOnHome: false }).expect(200);
    await create({ showOnHome: true }).expect(201);
  });

  it('validates lengths', async () => {
    await create({ question: 'x'.repeat(201) }).expect(400);
    await create({ answer: 'x'.repeat(5001) }).expect(400);
    await create({ answer: '' }).expect(400);
    await create({ group: 'x'.repeat(61) }).expect(400);
  });
});
