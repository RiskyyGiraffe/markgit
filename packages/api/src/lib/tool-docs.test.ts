import { describe, expect, it } from 'vitest';
import {
  buildToolDocumentation,
  buildToolOpenApi,
  buildUsageSummary,
  exampleFromSchema,
} from './tool-docs.js';

const documentedTool = {
  kind: 'tool' as const,
  id: 'tool-id',
  slug: 'weather-now',
  name: 'Weather Now',
  description: 'Returns current weather.',
  category: 'weather',
  tags: ['weather'],
  provider: { id: 'provider-id', name: 'Weather Labs', trustTier: 'verified' as const },
  version: { number: 1, manifestDigest: 'digest', immutable: true },
  trust: {
    provider: { tier: 'verified', paymentVerified: true },
    endpoint: { status: 'verified', origin: 'https://tools.example.com', verifiedAt: new Date() },
    version: { status: 'versioned', manifestDigest: 'digest' },
    behavior: { status: 'established', evidence: 'markgit_calls' },
  },
  risk: {
    level: 'low',
    capabilities: { readOnly: true },
  },
  policy: {
    callable: true,
    eligibleForAutoCall: true,
    approval: { requirement: 'covered_by_user_policy', manifestDigest: 'digest' },
    reasons: [],
  },
  pricing: { type: 'per_call' as const, currency: 'USD' as const, amount: '0.0100' },
  usage: buildUsageSummary(1_250, 125),
  inputSchema: {
    type: 'object',
    required: ['city'],
    properties: { city: { type: 'string', example: 'New York' } },
  },
  outputSchema: {
    type: 'object',
    properties: { temperature: { type: 'number', example: 72 } },
  },
  access: { mode: 'gateway' as const, endpoint: { path: '/v1/tools/weather-now/call', method: 'POST' as const } },
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('buildUsageSummary', () => {
  it('uses privacy-friendly labels for small tools', () => {
    expect(buildUsageSummary(999, 99)).toMatchObject({
      invocationsLabel: 'Under 1K invokes',
      usersLabel: 'Under 100 users',
    });
  });

  it('uses compact counts after the public thresholds', () => {
    expect(buildUsageSummary(1_250, 125)).toMatchObject({
      invocationsLabel: '1.3K invokes',
      usersLabel: '125 users',
    });
  });
});

describe('exampleFromSchema', () => {
  it('builds a representative object from JSON Schema', () => {
    expect(exampleFromSchema({
      type: 'object',
      properties: {
        city: { type: 'string', example: 'New York' },
        units: { type: 'string', enum: ['metric', 'imperial'] },
        days: { type: 'integer' },
      },
    })).toEqual({ city: 'New York', units: 'metric', days: 1 });
  });
});

describe('tool documentation', () => {
  it('nests the tool input and output schemas in the normalized call contract', () => {
    const docs = buildToolDocumentation(documentedTool, 'https://api.markgit.com');
    expect(docs.invocation.call.requestExample).toEqual({
      quoteId: 'approved-quote-id',
      input: { city: 'New York' },
    });
    expect(docs.invocation.call.responseExample.output).toEqual({ temperature: 72 });
  });

  it('emits importable OpenAPI 3.1 operations', () => {
    const openapi = buildToolOpenApi(documentedTool, 'https://api.markgit.com');
    expect(openapi.openapi).toBe('3.1.0');
    expect(Object.keys(openapi.paths)).toEqual([
      '/v1/tools/weather-now/quote',
      '/v1/tools/weather-now/call',
    ]);
  });
});
