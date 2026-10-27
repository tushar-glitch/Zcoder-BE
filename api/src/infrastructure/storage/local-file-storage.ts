import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { FileStorage } from './file-storage.js';

export class LocalFileStorage extends FileStorage {
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(directory: string, baseUrl: string) {
    super();
    this.root = resolve(directory);
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  urlFor(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) {
      throw new Error('Storage key escapes the upload directory');
    }
    return path;
  }
}
