const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const RATE_LIMITS = {
  login: { limit: 5, ttl: 15 * MINUTE_MS },
  forgotPassword: { limit: 3, ttl: HOUR_MS },
  inquiry: { limit: 5, ttl: HOUR_MS },
  public: { limit: 300, ttl: 15 * MINUTE_MS },
  admin: { limit: 1000, ttl: 15 * MINUTE_MS },
} as const;

export const INTERNAL_SECRET_HEADER = 'x-internal-secret';
