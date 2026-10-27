import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TestApp } from './support/test-app.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const url = '/api/v1/admin/dashboard/stats';

describe('dashboard', () => {
  let testApp: TestApp;

  const submit = (n: number) =>
    testApp
      .anonymous()
      .post('/api/v1/public/inquiries')
      .send({ type: 'CONTACT', name: `Visitor ${n}`, email: `v${n}@example.com`, subject: `Subject ${n}`, message: `Message number ${n} for the dashboard.` })
      .expect(201);

  const setBlog = (id: string, status: 'DRAFT' | 'PUBLISHED') => testApp.catalog.blogs.set(id, { id, status } as never);

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  it('requires an admin session', async () => {
    await testApp.anonymous().get(url).expect(401);
  });

  it('returns zeros and empty lists when nothing exists', async () => {
    const { body } = await testApp.admin.get(url).expect(200);

    expect(body.data).toMatchObject({
      newInquiries: 0,
      inProgressInquiries: 0,
      inquiriesLast30Days: 0,
      failedReplies: 0,
      publishedBlogs: 0,
      draftBlogs: 0,
      latestInquiries: [],
    });
  });

  it('counts inquiries by status, the last 30 days, failed replies and blogs', async () => {
    for (let n = 1; n <= 7; n++) await submit(n);
    const [first, second, old] = [...testApp.inquiries.inquiries.values()];
    first.status = 'IN_PROGRESS';
    second.status = 'REPLIED';
    old.createdAt = new Date(Date.now() - 31 * DAY_MS);
    const reply = await testApp.inquiries.createReply({ inquiryId: first.id, subject: 'Hello', body: 'Body of the reply', sentById: null });
    await testApp.inquiries.markReplyFailed(reply.id, 'smtp down');
    setBlog('b1', 'PUBLISHED');
    setBlog('b2', 'PUBLISHED');
    setBlog('b3', 'DRAFT');

    const { body } = await testApp.admin.get(url).expect(200);

    expect(body.data).toMatchObject({
      newInquiries: 5,
      inProgressInquiries: 1,
      inquiriesLast30Days: 6,
      failedReplies: 1,
      publishedBlogs: 2,
      draftBlogs: 1,
    });
  });

  it('lists the five newest inquiries as summaries without the message', async () => {
    for (let n = 1; n <= 7; n++) {
      await submit(n);
      [...testApp.inquiries.inquiries.values()][n - 1].createdAt = new Date(Date.now() + n * 1000);
    }

    const { body } = await testApp.admin.get(url).expect(200);

    expect(body.data.latestInquiries.map((row: { name: string }) => row.name)).toEqual([7, 6, 5, 4, 3].map((n) => `Visitor ${n}`));
    expect(body.data.latestInquiries[0]).not.toHaveProperty('message');
  });

  it('returns the most recent audit activity with the acting admin', async () => {
    await testApp.admin.post('/api/v1/admin/categories').send({ name: 'Dashboard Category' }).expect(201);

    const { body } = await testApp.admin.get(url).expect(200);

    expect(body.data.recentActivity[0]).toMatchObject({ action: 'category.create', admin: { name: 'Zoy Admin' } });
  });
});
