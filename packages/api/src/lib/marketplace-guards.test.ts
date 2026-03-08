import { describe, expect, it } from 'vitest';
import {
  addUsd,
  canReuseSession,
  ensureBudgetWithinLimit,
  ensureHoldIsActive,
  ensureResourceOwnership,
} from './marketplace-guards.js';
import { ForbiddenError, ValidationError } from './errors.js';

describe('marketplace guards', () => {
  it('adds USD values using ledger precision', () => {
    expect(addUsd('1.2300', '0.0050', '2.1000')).toBe('3.3350');
  });

  it('allows budget usage exactly at the limit', () => {
    expect(() => ensureBudgetWithinLimit('10.0000', '7.5000', '2.5000')).not.toThrow();
  });

  it('rejects budget usage above the limit', () => {
    expect(() => ensureBudgetWithinLimit('10.0000', '9.0000', '1.0001')).toThrow(
      ForbiddenError,
    );
  });

  it('rejects ownership mismatches', () => {
    expect(() => ensureResourceOwnership('Wallet', 'user-a', 'user-b')).toThrow(ForbiddenError);
  });

  it('rejects non-active hold transitions', () => {
    expect(() => ensureHoldIsActive('captured')).toThrow(ValidationError);
  });

  it('only reuses sessions for the same user and api key', () => {
    expect(canReuseSession('user-1', 'key-1', 'user-1', 'key-1')).toBe(true);
    expect(canReuseSession('user-1', 'key-1', 'user-1', 'key-2')).toBe(false);
    expect(canReuseSession('user-1', 'key-1', 'user-2', 'key-1')).toBe(false);
  });
});
