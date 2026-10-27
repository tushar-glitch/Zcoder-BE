import { Injectable } from '@nestjs/common';
import { LOCK_DURATION_SECONDS, MAX_FAILED_LOGINS } from '../auth.constants.js';

export interface LockState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

@Injectable()
export class AccountLockPolicy {
  isLocked({ lockedUntil }: LockState, now: Date): boolean {
    return lockedUntil !== null && lockedUntil > now;
  }

  retryAfterSeconds({ lockedUntil }: LockState, now: Date): number {
    return lockedUntil ? Math.max(0, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)) : 0;
  }

  afterFailure(state: LockState, now: Date): LockState {
    const lockExpired = state.lockedUntil !== null && state.lockedUntil <= now;
    const failedLoginAttempts = (lockExpired ? 0 : state.failedLoginAttempts) + 1;

    if (failedLoginAttempts < MAX_FAILED_LOGINS) {
      return { failedLoginAttempts, lockedUntil: null };
    }
    return { failedLoginAttempts, lockedUntil: new Date(now.getTime() + LOCK_DURATION_SECONDS * 1000) };
  }

  afterSuccess(): LockState {
    return { failedLoginAttempts: 0, lockedUntil: null };
  }
}
