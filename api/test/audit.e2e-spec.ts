import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TestApp } from './support/test-app.js';

const ENTITY_ID = '6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11';

describe('GET /admin/audit-logs', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
    const adminId = [...testApp.admins.admins.keys()][0];
    await testApp.audit.create({ adminId, action: 'blog.publish', entityType: 'blog', entityId: ENTITY_ID });
    await testApp.audit.create({ adminId, action: 'media.upload', entityType: 'media' });
    await testApp.audit.create({ adminId: null, action: 'notification.failed', entityType: 'inquiry' });
  });

  afterEach(() => testApp.close());

  it('requires an admin session', async () => {
    await testApp.anonymous().get('/api/v1/admin/audit-logs').expect(401);
  });

  it('lists newest first inside the paginated envelope', async () => {
    const response = await testApp.admin.get('/api/v1/admin/audit-logs?pageSize=2').expect(200);

    expect(response.body.data.map((entry: { action: string }) => entry.action)).toEqual([
      'notification.failed',
      'media.upload',
    ]);
    expect(response.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
  });

  it('includes the admin name, and null for system actions', async () => {
    const response = await testApp.admin.get('/api/v1/admin/audit-logs').expect(200);

    expect(response.body.data[0].admin).toBeNull();
    expect(response.body.data[1].admin).toMatchObject({ name: 'Zoy Admin' });
  });

  it('filters by entity', async () => {
    const response = await testApp.admin
      .get(`/api/v1/admin/audit-logs?entityType=blog&entityId=${ENTITY_ID}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ action: 'blog.publish', entityId: ENTITY_ID });
  });

  it('rejects a malformed id filter', async () => {
    await testApp.admin.get('/api/v1/admin/audit-logs?adminId=nope').expect(400);
  });
});
