import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('verifies the original password', async () => {
    const hash = await hasher.hash('correct horse battery');

    expect(await hasher.verify('correct horse battery', hash)).toBe(true);
  });

  it('rejects a different password', async () => {
    const hash = await hasher.hash('correct horse battery');

    expect(await hasher.verify('wrong password', hash)).toBe(false);
  });

  it('never stores the plain text and salts every hash', async () => {
    const first = await hasher.hash('same-password');
    const second = await hasher.hash('same-password');

    expect(first).not.toContain('same-password');
    expect(first).not.toBe(second);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await hasher.verify('anything', 'not-a-hash')).toBe(false);
    expect(await hasher.verify('anything', 'scrypt$x$y$z$abc$def')).toBe(false);
  });
});
