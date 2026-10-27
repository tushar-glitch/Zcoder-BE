import { describe, expect, it } from 'vitest';
import { AccountLockPolicy, LockState } from './account-lock.policy.js';

const policy = new AccountLockPolicy();
const now = new Date('2026-10-27T10:00:00Z');

describe('AccountLockPolicy', () => {
  it('counts failures without locking before the limit', () => {
    const state = policy.afterFailure({ failedLoginAttempts: 3, lockedUntil: null }, now);

    expect(state).toEqual({ failedLoginAttempts: 4, lockedUntil: null });
  });

  it('locks for 15 minutes on the fifth failure', () => {
    const state = policy.afterFailure({ failedLoginAttempts: 4, lockedUntil: null }, now);

    expect(state.lockedUntil).toEqual(new Date('2026-10-27T10:15:00Z'));
    expect(policy.isLocked(state, now)).toBe(true);
    expect(policy.retryAfterSeconds(state, now)).toBe(900);
  });

  it('starts counting again after an expired lock', () => {
    const expired: LockState = { failedLoginAttempts: 5, lockedUntil: new Date('2026-10-27T09:59:00Z') };

    expect(policy.isLocked(expired, now)).toBe(false);
    expect(policy.afterFailure(expired, now)).toEqual({ failedLoginAttempts: 1, lockedUntil: null });
  });

  it('clears the state on success', () => {
    expect(policy.afterSuccess()).toEqual({ failedLoginAttempts: 0, lockedUntil: null });
  });
});
