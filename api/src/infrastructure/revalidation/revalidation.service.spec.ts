import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../modules/audit/audit.service.js';
import { RevalidationService } from './revalidation.service.js';

const config = {
  get: (key: string) => ({ APP_URL: 'http://localhost:3000', REVALIDATE_SECRET: 'a-revalidate-secret-of-at-least-32-chars' })[key],
} as unknown as ConfigService<never, true>;

describe('RevalidationService', () => {
  const record = vi.fn();
  const fetchMock = vi.fn();
  let service: RevalidationService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
    record.mockReset();
    fetchMock.mockReset();
    service = new RevalidationService(config, { record } as unknown as AuditService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts the unique tags with the secret header', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    service.revalidate(['blogs', 'blog:a', 'blogs']);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/revalidate');
    expect(init.headers['x-revalidate-secret']).toBe('a-revalidate-secret-of-at-least-32-chars');
    expect(JSON.parse(init.body)).toEqual({ tags: ['blogs', 'blog:a'] });
    expect(record).not.toHaveBeenCalled();
  });

  it('retries and succeeds without recording a failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ ok: true });

    service.revalidate(['blogs']);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(record).not.toHaveBeenCalled();
  });

  it('gives up after three attempts and records revalidate.failed', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    service.revalidate(['blogs']);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenCalledWith({
      adminId: null,
      action: 'revalidate.failed',
      entityType: 'site',
      metadata: { tags: ['blogs'] },
    });
  });
});
