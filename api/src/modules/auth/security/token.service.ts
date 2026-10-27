import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

export interface AccessTokenPayload {
  adminId: string;
  sessionId: string;
}

const OPAQUE_TOKEN_BYTES = 32;

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccessToken({ adminId, sessionId }: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync({ sub: adminId, sid: sessionId });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { sub, sid } = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token);
      return { adminId: sub, sessionId: sid };
    } catch {
      return null;
    }
  }

  generateOpaqueToken(): string {
    return randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
  }

  hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
