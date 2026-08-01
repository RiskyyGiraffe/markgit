import { describe, expect, it } from 'vitest';
import type { ToolPolicyDecision } from '../lib/tool-policy.js';
import { applyQuicklistAuthorization } from './quicklist.js';

const base: ToolPolicyDecision = {
  callable: true,
  monetizationEligible: true,
  eligibleForAutoCall: true,
  riskLevel: 'low',
  approval: { requirement: 'covered_by_user_policy', manifestDigest: 'digest-1' },
  reasons: [],
};

describe('quicklist authorization', () => {
  it('asks for every call when configured', () => {
    const policy = applyQuicklistAuthorization(base, {
      authorizationMode: 'ask_every', authorizationManifestDigest: null,
    }, { isPaid: false, manifestDigest: 'digest-1' });
    expect(policy.approval.requirement).toBe('per_call');
    expect(policy.userAuthorization?.mode).toBe('ask_every');
  });

  it('asks only for charged calls in the default quicklist mode', () => {
    const preference = { authorizationMode: 'ask_paid', authorizationManifestDigest: null };
    expect(applyQuicklistAuthorization(base, preference, { isPaid: true, manifestDigest: 'digest-1' }).approval.requirement).toBe('per_call');
    expect(applyQuicklistAuthorization(base, preference, { isPaid: false, manifestDigest: 'digest-1' }).approval.requirement).toBe('covered_by_user_policy');
  });

  it('never-ask authorization is bound to the exact version', () => {
    const preference = { authorizationMode: 'never_ask', authorizationManifestDigest: 'digest-1' };
    const highRisk = { ...base, riskLevel: 'high' as const, approval: { ...base.approval, requirement: 'per_call' as const } };
    expect(applyQuicklistAuthorization(highRisk, preference, { isPaid: true, manifestDigest: 'digest-1' }).approval.requirement).toBe('covered_by_user_policy');
    expect(applyQuicklistAuthorization(highRisk, preference, { isPaid: true, manifestDigest: 'digest-2' }).approval.requirement).toBe('per_call');
  });

  it('never bypasses unverified or blocked safety requirements', () => {
    const preference = { authorizationMode: 'never_ask', authorizationManifestDigest: 'digest-1' };
    const unverified = { ...base, approval: { ...base.approval, requirement: 'explicit_unverified' as const } };
    expect(applyQuicklistAuthorization(unverified, preference, { isPaid: false, manifestDigest: 'digest-1' }).approval.requirement).toBe('explicit_unverified');
    expect(applyQuicklistAuthorization(unverified, {
      authorizationMode: 'ask_every', authorizationManifestDigest: null,
    }, { isPaid: false, manifestDigest: 'digest-1' }).approval.requirement).toBe('explicit_unverified');
  });
});
