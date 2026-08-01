import { describe, expect, it } from 'vitest';
import {
  classifyToolRisk,
  computeToolPolicy,
  digestToolManifest,
  endpointMatchesVerifiedOrigin,
  normalizeToolCapabilities,
} from './tool-policy.js';

describe('tool trust policy', () => {
  it('produces stable digests regardless of object key order', () => {
    expect(digestToolManifest({ b: 2, a: { y: 2, x: 1 } })).toBe(
      digestToolManifest({ a: { x: 1, y: 2 }, b: 2 }),
    );
  });

  it('treats missing declarations as unknown risk', () => {
    expect(classifyToolRisk(normalizeToolCapabilities(undefined))).toBe('unknown');
    expect(classifyToolRisk(normalizeToolCapabilities(null))).toBe('unknown');
  });

  it('classifies destructive and money-moving tools as critical', () => {
    const capabilities = normalizeToolCapabilities({ readOnly: false, spendsMoney: true });
    expect(classifyToolRisk(capabilities)).toBe('critical');
  });

  it('allows verified low-risk tools to use standing policy', () => {
    const policy = computeToolPolicy({
      productStatus: 'active',
      moderationStatus: 'clear',
      pricePerCallUsd: '0.0000',
      manifestDigest: 'abc',
      capabilities: normalizeToolCapabilities({
        readOnly: true,
        openWorld: false,
        seesUntrustedContent: false,
        dataRetention: 'none',
      }),
      endpointVerified: true,
      paymentVerified: false,
    });
    expect(policy).toMatchObject({
      callable: true,
      eligibleForAutoCall: true,
      riskLevel: 'low',
      approval: { requirement: 'covered_by_user_policy' },
    });
  });

  it('keeps free unverified tools open but requires explicit approval', () => {
    const policy = computeToolPolicy({
      productStatus: 'active',
      moderationStatus: 'clear',
      pricePerCallUsd: '0.0000',
      manifestDigest: 'abc',
      capabilities: normalizeToolCapabilities(undefined),
      endpointVerified: false,
      paymentVerified: false,
    });
    expect(policy.callable).toBe(true);
    expect(policy.approval.requirement).toBe('explicit_unverified');
  });

  it('blocks paid tools until endpoint and payment identity are verified', () => {
    const policy = computeToolPolicy({
      productStatus: 'active',
      moderationStatus: 'clear',
      pricePerCallUsd: '1.0000',
      manifestDigest: 'abc',
      capabilities: normalizeToolCapabilities({ readOnly: true }),
      endpointVerified: true,
      paymentVerified: false,
    });
    expect(policy.callable).toBe(false);
    expect(policy.approval.requirement).toBe('blocked');
  });

  it('matches only the exact endpoint origin among active verified origins', () => {
    const config = { baseUrl: 'https://api.example.com/v1/weather' };
    expect(endpointMatchesVerifiedOrigin(config, [
      'https://other.example.com',
      'https://api.example.com',
    ])).toBe(true);
    expect(endpointMatchesVerifiedOrigin(config, ['https://example.com'])).toBe(false);
  });
});
