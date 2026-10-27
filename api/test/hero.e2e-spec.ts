import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TestApp } from './support/test-app.js';

const MISSING_ID = '6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11';
const complete = {
  heading: 'We build software',
  subheading: 'Websites, apps and APIs for growing teams.',
  primaryCta: { label: 'Get a quote', url: '/contact' },
};

describe('admin hero', () => {
  let testApp: TestApp;
  const url = (suffix = '') => `/api/v1/admin/hero${suffix}`;
  const create = (body: object = {}) => testApp.admin.post(url()).send({ title: 'Homepage v1', ...body });

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  it('requires an admin session', async () => {
    await testApp.anonymous().get(url()).expect(401);
    await testApp.anonymous().post(url()).send({ title: 'x' }).expect(401);
  });

  it('creates a draft from just an internal title', async () => {
    const response = await create().expect(201);

    expect(response.body.data).toMatchObject({
      title: 'Homepage v1',
      status: 'DRAFT',
      isDefault: false,
      heading: null,
      primaryCta: null,
      secondaryCta: null,
      image: null,
    });
    expect(testApp.audit.entries[0]).toMatchObject({ action: 'hero.create', entityType: 'hero' });
    expect(testApp.revalidated).toEqual([]);
  });

  it('stores both CTAs and an image', async () => {
    const image = await testApp.media.create({ fileName: 'h.png', altText: 'Hero', storageKey: '2026/10/h', mimeType: 'image/webp', sizeBytes: 1, width: 1600, height: 900 });

    const response = await create({
      ...complete,
      secondaryCta: { label: 'See our work', url: 'https://zoycoders.com/portfolio' },
      imageId: image.id,
    }).expect(201);

    expect(response.body.data).toMatchObject({
      primaryCta: { label: 'Get a quote', url: '/contact' },
      secondaryCta: { label: 'See our work', url: 'https://zoycoders.com/portfolio' },
    });
    expect(response.body.data.image.id).toBe(image.id);
  });

  it.each([
    ['a javascript: url', 'javascript:alert(1)'],
    ['a protocol-relative url', '//evil.example'],
    ['a plain http url', 'http://insecure.example'],
    ['a relative path without a slash', 'contact'],
    ['a url with spaces', '/a b'],
  ])('rejects %s in a CTA', async (_label, badUrl) => {
    const response = await create({ primaryCta: { label: 'Go', url: badUrl } }).expect(400);

    expect(response.body.error.details[0].path).toBe('primaryCta.url');
  });

  it('validates the other fields', async () => {
    await testApp.admin.post(url()).send({}).expect(400);
    await create({ title: 'x'.repeat(81) }).expect(400);
    await create({ heading: 'x'.repeat(81) }).expect(400);
    await create({ subheading: 'x'.repeat(201) }).expect(400);
    await create({ primaryCta: { label: 'x'.repeat(31), url: '/ok' } }).expect(400);
    await create({ primaryCta: { label: '', url: '/ok' } }).expect(400);
    await create({ primaryCta: { label: 'Missing url' } }).expect(400);
    await create({ imageId: MISSING_ID }).expect(400);
    await create({ isPublished: true }).expect(400);
  });

  it('updates only what is sent, and can clear a CTA or the image', async () => {
    const image = await testApp.media.create({ fileName: 'h.png', altText: 'Hero', storageKey: '2026/10/h', mimeType: 'image/webp', sizeBytes: 1, width: 1600, height: 900 });
    const hero = (await create({ ...complete, secondaryCta: { label: 'More', url: '/more' }, imageId: image.id }).expect(201)).body.data;

    const renamed = await testApp.admin.patch(url(`/${hero.id}`)).send({ heading: 'New heading' }).expect(200);
    const cleared = await testApp.admin.patch(url(`/${hero.id}`)).send({ secondaryCta: null, imageId: null }).expect(200);
    const ignored = await testApp.admin.patch(url(`/${hero.id}`)).send({ title: null }).expect(200);

    expect(renamed.body.data).toMatchObject({ heading: 'New heading', primaryCta: complete.primaryCta });
    expect(cleared.body.data).toMatchObject({ secondaryCta: null, image: null, heading: 'New heading' });
    expect(ignored.body.data.title).toBe('Homepage v1');
  });

  describe('publishing', () => {
    it('lists every missing requirement', async () => {
      const hero = (await create().expect(201)).body.data;

      const response = await testApp.admin.post(url(`/${hero.id}/publish`)).expect(400);

      expect(response.body.error.details.map((d: { path: string }) => d.path)).toEqual(['heading', 'subheading', 'primaryCta']);
    });

    it('publishes a complete hero and revalidates the site', async () => {
      const hero = (await create(complete).expect(201)).body.data;

      const response = await testApp.admin.post(url(`/${hero.id}/publish`)).expect(200);

      expect(response.body.data.status).toBe('PUBLISHED');
      expect(testApp.revalidated).toEqual([['hero']]);
      expect(testApp.audit.entries.at(-1)).toMatchObject({ action: 'hero.publish', entityId: hero.id });
    });

    it('demotes the previously published hero to a draft', async () => {
      const first = (await create({ ...complete, title: 'First' }).expect(201)).body.data;
      const second = (await create({ ...complete, title: 'Second' }).expect(201)).body.data;
      await testApp.admin.post(url(`/${first.id}/publish`)).expect(200);

      await testApp.admin.post(url(`/${second.id}/publish`)).expect(200);

      const heroes = (await testApp.admin.get(url()).expect(200)).body.data;
      expect(heroes.map((h: { title: string; status: string }) => [h.title, h.status])).toEqual([
        ['Second', 'PUBLISHED'],
        ['First', 'DRAFT'],
      ]);
    });

    it('lists the published hero first', async () => {
      await create({ ...complete, title: 'Older draft' }).expect(201);
      const live = (await create({ ...complete, title: 'Live' }).expect(201)).body.data;
      await create({ title: 'Newest draft' }).expect(201);
      await testApp.admin.post(url(`/${live.id}/publish`)).expect(200);

      const heroes = (await testApp.admin.get(url()).expect(200)).body.data;

      expect(heroes[0].title).toBe('Live');
    });

    it('unpublishes so the site falls back to the default hero', async () => {
      const hero = (await create(complete).expect(201)).body.data;
      await testApp.admin.post(url(`/${hero.id}/publish`)).expect(200);
      testApp.revalidated.length = 0;

      const response = await testApp.admin.post(url(`/${hero.id}/unpublish`)).expect(200);

      expect(response.body.data.status).toBe('DRAFT');
      expect(testApp.revalidated).toEqual([['hero']]);
    });

    it('refuses to unpublish a draft and 404s for unknown heroes', async () => {
      const hero = (await create().expect(201)).body.data;

      await testApp.admin.post(url(`/${hero.id}/unpublish`)).expect(409);
      await testApp.admin.post(url(`/${MISSING_ID}/publish`)).expect(404);
    });
  });

  describe('editing and deleting', () => {
    it('revalidates only when the published hero is edited', async () => {
      const live = (await create({ ...complete, title: 'Live' }).expect(201)).body.data;
      const draft = (await create({ title: 'Draft' }).expect(201)).body.data;
      await testApp.admin.post(url(`/${live.id}/publish`)).expect(200);
      testApp.revalidated.length = 0;

      await testApp.admin.patch(url(`/${draft.id}`)).send({ heading: 'Draft edit' }).expect(200);
      expect(testApp.revalidated).toEqual([]);

      await testApp.admin.patch(url(`/${live.id}`)).send({ heading: 'Live edit' }).expect(200);
      expect(testApp.revalidated).toEqual([['hero']]);
    });

    it('refuses to delete the published hero but deletes a draft', async () => {
      const live = (await create(complete).expect(201)).body.data;
      const draft = (await create({ title: 'Draft' }).expect(201)).body.data;
      await testApp.admin.post(url(`/${live.id}/publish`)).expect(200);

      const refusal = await testApp.admin.delete(url(`/${live.id}`)).expect(409);
      await testApp.admin.delete(url(`/${draft.id}`)).expect(204);

      expect(refusal.body.error.code).toBe('CONFLICT');
      expect((await testApp.admin.get(url()).expect(200)).body.data).toHaveLength(1);
    });

    it('returns 404 for unknown ids and 400 for malformed ones', async () => {
      await testApp.admin.get(url(`/${MISSING_ID}`)).expect(404);
      await testApp.admin.patch(url(`/${MISSING_ID}`)).send({ heading: 'x' }).expect(404);
      await testApp.admin.delete(url(`/${MISSING_ID}`)).expect(404);
      await testApp.admin.get(url('/nope')).expect(400);
    });
  });
});
