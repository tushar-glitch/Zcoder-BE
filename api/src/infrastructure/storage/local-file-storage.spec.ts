import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFileStorage } from './local-file-storage.js';

describe('LocalFileStorage', () => {
  let directory: string;
  let storage: LocalFileStorage;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'zoy-storage-'));
    storage = new LocalFileStorage(directory, 'http://localhost:4000/uploads/');
  });

  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('stores a file under nested keys', async () => {
    await storage.put('2026/10/a.webp', Buffer.from('hello'));

    expect((await readFile(join(directory, '2026/10/a.webp'))).toString()).toBe('hello');
  });

  it('deletes a file and ignores a missing one', async () => {
    await storage.put('a.webp', Buffer.from('x'));

    await storage.delete('a.webp');
    await storage.delete('a.webp');

    await expect(stat(join(directory, 'a.webp'))).rejects.toThrow();
  });

  it('builds a public url without a double slash', () => {
    expect(storage.urlFor('2026/10/a.webp')).toBe('http://localhost:4000/uploads/2026/10/a.webp');
  });

  it('refuses keys that escape the directory', async () => {
    await expect(storage.put('../outside.webp', Buffer.from('x'))).rejects.toThrow();
  });
});
