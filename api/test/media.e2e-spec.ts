import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStorage } from '../src/infrastructure/storage/file-storage.js';
import { MediaRepository } from '../src/modules/media/media.repository.js';
import { InMemoryFileStorage, InMemoryMediaRepository } from './support/in-memory-content.js';
import { createTestApp, TestApp } from './support/test-app.js';

const png = (width = 2000, height = 1000): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } }).png().toBuffer();

describe('admin media', () => {
  let testApp: TestApp;
  let storage: InMemoryFileStorage;
  let media: InMemoryMediaRepository;

  beforeEach(async () => {
    storage = new InMemoryFileStorage();
    media = new InMemoryMediaRepository();
    testApp = await createTestApp((builder) =>
      builder.overrideProvider(FileStorage).useValue(storage).overrideProvider(MediaRepository).useValue(media),
    );
  });

  afterEach(() => testApp.close());

  const upload = async (altText = 'A blue test banner', name = 'banner.png', data?: Buffer) =>
    testApp.admin.post('/api/v1/admin/media').field('altText', altText).attach('file', data ?? (await png()), name);

  describe('POST /admin/media', () => {
    it('re-encodes the image to WebP variants and returns their urls', async () => {
      const response = await upload().then((r) => r);

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        altText: 'A blue test banner',
        mimeType: 'image/webp',
        width: 1600,
        height: 800,
      });
      expect(response.body.data.url).toMatch(/^http:\/\/localhost:4000\/uploads\/\d{4}\/\d{2}\/.+-1600\.webp$/);
      expect(response.body.data.variants.thumbnailUrl).toMatch(/-320\.webp$/);
      expect(response.body.data.variants.mediumUrl).toMatch(/-800\.webp$/);
      expect(storage.files.size).toBe(3);
      for (const file of storage.files.values()) {
        expect((await sharp(file).metadata()).format).toBe('webp');
      }
    });

    it('never enlarges a small image', async () => {
      const response = await upload('A tiny test icon', 'tiny.png', await png(100, 50)).then((r) => r);

      expect(response.body.data).toMatchObject({ width: 100, height: 50 });
    });

    it('rejects a request without a file', async () => {
      const response = await testApp.admin.post('/api/v1/admin/media').field('altText', 'No file attached').expect(400);

      expect(response.body.error.details).toEqual([{ path: 'file', message: 'file is required' }]);
    });

    it('rejects a missing or too-short alt text', async () => {
      const response = await upload('abc').then((r) => r);

      expect(response.status).toBe(400);
      expect(response.body.error.details[0].path).toBe('altText');
    });

    it('rejects a non-image even if it is named like one', async () => {
      const response = await upload('Not really an image', 'fake.png', Buffer.from('just some text')).then((r) => r);

      expect(response.status).toBe(415);
      expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects a GIF', async () => {
      const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).gif().toBuffer();

      expect((await upload('A tiny animated gif', 'a.gif', gif)).status).toBe(415);
    });

    it('rejects a file over 5 MB', async () => {
      const response = await upload('Far too large image', 'big.png', randomBytes(5 * 1024 * 1024 + 1)).then((r) => r);

      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('requires an admin session', async () => {
      await testApp.anonymous().post('/api/v1/admin/media').expect(401);
    });

    it('records an audit entry for the upload', async () => {
      const response = await upload().then((r) => r);

      expect(testApp.audit.entries).toMatchObject([
        { action: 'media.upload', entityType: 'media', entityId: response.body.data.id },
      ]);
      expect(testApp.audit.entries[0].adminId).not.toBeNull();
    });
  });

  describe('GET /admin/media', () => {
    it('lists newest first with pagination meta', async () => {
      await upload('First image alt text', 'first.png');
      await upload('Second image alt text', 'second.png');

      const response = await testApp.admin.get('/api/v1/admin/media?pageSize=1').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].altText).toBe('Second image alt text');
      expect(response.body.meta).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    });

    it('searches file name and alt text', async () => {
      await upload('Team photo for about page', 'team.png');
      await upload('Office exterior at night', 'office.png');

      const byAlt = await testApp.admin.get('/api/v1/admin/media?q=night').expect(200);
      const byName = await testApp.admin.get('/api/v1/admin/media?q=TEAM').expect(200);

      expect(byAlt.body.data.map((m: { altText: string }) => m.altText)).toEqual(['Office exterior at night']);
      expect(byName.body.data).toHaveLength(1);
    });

    it('rejects an unknown sort field and an oversized page', async () => {
      await testApp.admin.get('/api/v1/admin/media?sort=altText:asc').expect(400);
      await testApp.admin.get('/api/v1/admin/media?pageSize=101').expect(400);
    });
  });

  describe('PATCH /admin/media/:id', () => {
    it('updates the alt text', async () => {
      const created = (await upload()).body.data;

      const response = await testApp.admin
        .patch(`/api/v1/admin/media/${created.id}`)
        .send({ altText: 'A better description' })
        .expect(200);

      expect(response.body.data.altText).toBe('A better description');
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      await testApp.admin
        .patch('/api/v1/admin/media/6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11')
        .send({ altText: 'Does not exist' })
        .expect(404);
      await testApp.admin.patch('/api/v1/admin/media/not-a-uuid').send({ altText: 'Does not matter' }).expect(400);
    });
  });

  describe('DELETE /admin/media/:id', () => {
    it('removes the record and every stored variant', async () => {
      const created = (await upload()).body.data;

      await testApp.admin.delete(`/api/v1/admin/media/${created.id}`).expect(204);

      expect(media.items.size).toBe(0);
      expect(storage.files.size).toBe(0);
    });

    it('refuses to delete media that is still in use and keeps the files', async () => {
      const created = (await upload()).body.data;
      media.inUse.add(created.id);

      const response = await testApp.admin.delete(`/api/v1/admin/media/${created.id}`).expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
      expect(storage.files.size).toBe(3);
    });
  });
});
