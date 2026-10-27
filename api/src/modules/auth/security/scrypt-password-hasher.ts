import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, ScryptOptions, timingSafeEqual } from 'node:crypto';
import { PasswordHasher } from './password-hasher.js';

const FORMAT = 'scrypt';
const COST = 32768;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY_BYTES = 128 * COST * BLOCK_SIZE * 2;

@Injectable()
export class ScryptPasswordHasher extends PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await this.derive(plain, salt, { N: COST, r: BLOCK_SIZE, p: PARALLELISM });
    return [FORMAT, COST, BLOCK_SIZE, PARALLELISM, salt.toString('base64'), derived.toString('base64')].join('$');
  }

  async verify(plain: string, stored: string): Promise<boolean> {
    const [format, cost, blockSize, parallelism, salt, hash] = stored.split('$');
    if (format !== FORMAT || !salt || !hash) {
      return false;
    }

    try {
      const expected = Buffer.from(hash, 'base64');
      const actual = await this.derive(plain, Buffer.from(salt, 'base64'), {
        N: Number(cost),
        r: Number(blockSize),
        p: Number(parallelism),
      });
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  private derive(plain: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(plain, salt, KEY_LENGTH, { ...options, maxmem: MAX_MEMORY_BYTES }, (error, key) =>
        error ? reject(error) : resolve(key),
      );
    });
  }
}
