import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { TokenService } from './token.service.js';

const SECRET = 'a-test-secret-that-is-at-least-32-chars';
const payload = { adminId: 'admin-1', sessionId: 'session-1' };

function createService(expiresIn = 900): TokenService {
  return new TokenService(new JwtService({ secret: SECRET, signOptions: { expiresIn } }));
}

describe('TokenService', () => {
  it('round-trips an access token', async () => {
    const service = createService();

    expect(await service.verifyAccessToken(await service.signAccessToken(payload))).toEqual(payload);
  });

  it('rejects a tampered token', async () => {
    const service = createService();
    const token = await service.signAccessToken(payload);

    expect(await service.verifyAccessToken(`${token}x`)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const service = createService(-1);

    expect(await service.verifyAccessToken(await service.signAccessToken(payload))).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const foreign = new JwtService({ secret: 'another-secret-that-is-also-32-chars!!' });
    const token = await foreign.signAsync({ sub: 'admin-1', sid: 'session-1' });

    expect(await createService().verifyAccessToken(token)).toBeNull();
  });

  it('generates unique opaque tokens and hashes them deterministically', () => {
    const service = createService();
    const first = service.generateOpaqueToken();

    expect(first).not.toBe(service.generateOpaqueToken());
    expect(service.hashOpaqueToken(first)).toBe(service.hashOpaqueToken(first));
    expect(service.hashOpaqueToken(first)).not.toContain(first);
  });
});
