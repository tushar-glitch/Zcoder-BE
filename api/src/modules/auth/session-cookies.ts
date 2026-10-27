import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { API_PREFIX } from '../../app.setup.js';
import type { Environment } from '../../config/environment.js';
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';

const ACCESS_PATH = '/';
const REFRESH_PATH = `/${API_PREFIX}/auth`;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class SessionCookies {
  private readonly base: CookieOptions;

  constructor(config: ConfigService<Environment, true>) {
    this.base = { httpOnly: true, sameSite: 'lax', secure: config.get('NODE_ENV', { infer: true }) === 'production' };
  }

  set(response: Response, { accessToken, refreshToken }: SessionTokens): void {
    response.cookie(ACCESS_COOKIE, accessToken, {
      ...this.base,
      path: ACCESS_PATH,
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    response.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.base,
      path: REFRESH_PATH,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }

  clear(response: Response): void {
    response.clearCookie(ACCESS_COOKIE, { ...this.base, path: ACCESS_PATH });
    response.clearCookie(REFRESH_COOKIE, { ...this.base, path: REFRESH_PATH });
  }
}
