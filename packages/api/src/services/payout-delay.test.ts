import { describe, expect, it } from 'vitest';
import { providerPayoutEligibleAt, PROVIDER_EARNINGS_DELAY_MS } from './purchases.js';

describe('provider payout hold', () => {
  it('always delays new earnings by exactly three days', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    expect(PROVIDER_EARNINGS_DELAY_MS).toBe(259_200_000);
    expect(providerPayoutEligibleAt(now).toISOString()).toBe('2026-08-05T12:00:00.000Z');
  });
});
