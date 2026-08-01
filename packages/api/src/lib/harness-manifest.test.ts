import { describe, expect, it } from 'vitest';
import {
  harnessExecutionConfig,
  manifestHarnessCapabilities,
  manifestHarnessConfig,
  validateHarnessManifest,
  validateHarnessEventAccess,
} from './harness-manifest.js';

function validManifest() {
  return {
    schemaVersion: '1',
    kind: 'harness',
    name: 'Research Loop',
    slug: 'research-loop',
    description: 'Runs a bounded research loop.',
    runtime: {
      startUrl: 'https://runner.example.com/v1/runs',
      cancelUrl: 'https://runner.example.com/v1/cancel',
    },
    inputSchema: {
      type: 'object',
      required: ['question'],
      properties: { question: { type: 'string' } },
    },
    outputSchema: { type: 'object' },
    access: {
      externalApis: [{
        id: 'search-api',
        name: 'Search API',
        baseUrl: 'https://search.example.com/v1',
        purpose: 'Find public sources.',
        dataSent: ['search query'],
        dataReceived: ['public result snippets'],
        pricing: { type: 'per_call', amountUsd: '0.0020' },
      }],
      markgitTools: [{
        slug: 'current-weather',
        purpose: 'Check weather when relevant.',
        maxCallsPerRun: 2,
        maxSpendUsdPerRun: '0.0500',
      }],
      data: [{
        id: 'run-input',
        type: 'user_input',
        access: 'read',
        purpose: 'Read the requested research question.',
        scope: 'Only this run input',
      }],
      dataRetention: 'transient',
    },
    loop: { maxSteps: 20, maxRuntimeSeconds: 900, heartbeatSeconds: 15 },
    goal: { inputField: 'question', completionField: 'goalAchieved' },
    compaction: {
      supported: true,
      strategy: 'checkpoint',
      maxContextTokens: 64_000,
      preserves: ['goal', 'citations', 'spend to date'],
    },
    pricing: {
      externalApiCosts: 'user_supplied',
      note: 'Search calls are billed to the user by their API provider and itemized in run events.',
    },
  };
}

describe('harness manifest', () => {
  it('creates a transparent, bounded, versionable harness contract', () => {
    const manifest = validateHarnessManifest(validManifest());
    const config = manifestHarnessConfig(manifest);
    const capabilities = manifestHarnessCapabilities(manifest);
    expect(config.protocol).toBe('markgit.harness/v1');
    expect(config.access.externalApis[0]?.pricing.amountUsd).toBe('0.0020');
    expect(config.compaction.preserves).toContain('citations');
    expect(config.goal?.completionField).toBe('goalAchieved');
    expect(capabilities.openWorld).toBe(true);
    expect(capabilities.allowedOutboundDomains).toEqual(expect.arrayContaining([
      'runner.example.com',
      'search.example.com',
    ]));
    expect(harnessExecutionConfig(manifest).type).toBe('harness_http');
  });

  it('supports encrypted provider-managed authentication for loop endpoints', () => {
    const input = validManifest();
    (input.runtime as typeof input.runtime & { auth: Record<string, string> }).auth = {
      mode: 'provider_managed',
      type: 'bearer',
      location: 'header',
      name: 'Authorization',
      scheme: 'Bearer',
    };
    const manifest = validateHarnessManifest(input);
    expect(harnessExecutionConfig(manifest).auth).toMatchObject({
      mode: 'provider_managed',
      type: 'bearer',
      name: 'Authorization',
    });
  });

  it('rejects invalid goal fields and malformed wallet budgets', () => {
    const missingGoalField = validManifest();
    missingGoalField.goal.inputField = 'missing';
    expect(() => validateHarnessManifest(missingGoalField)).toThrow(/inputSchema property/);

    const invalidBudget = validManifest();
    invalidBudget.access.markgitTools[0].maxSpendUsdPerRun = '1.00001';
    expect(() => validateHarnessManifest(invalidBudget)).toThrow(/maxSpendUsdPerRun/);
  });

  it('requires pricing for every per-call external API', () => {
    const input = validManifest();
    delete (input.access.externalApis[0].pricing as { amountUsd?: string }).amountUsd;
    expect(() => validateHarnessManifest(input)).toThrow(/requires amountUsd/);
  });

  it('requires explicit access arrays even when a harness needs no access', () => {
    const input = validManifest();
    delete (input.access as { externalApis?: unknown }).externalApis;
    expect(() => validateHarnessManifest(input)).toThrow(/explicitly declare/);
  });

  it('rejects insecure remote runtimes', () => {
    const input = validManifest();
    input.runtime.startUrl = 'http://runner.example.com/start';
    expect(() => validateHarnessManifest(input)).toThrow(/must use HTTPS/);
  });

  it('rejects undeclared APIs and enriches declared API call events with pricing', () => {
    const manifest = validateHarnessManifest(validManifest());
    expect(() => validateHarnessEventAccess(manifest.access, 'external_api.call', {
      apiId: 'hidden-api',
      operation: 'query',
    })).toThrow(/declared in the frozen access manifest/);
    expect(validateHarnessEventAccess(manifest.access, 'external_api.call', {
      apiId: 'search-api',
      operation: 'query',
    })).toMatchObject({
      declaredApi: { name: 'Search API', pricing: { type: 'per_call', amountUsd: '0.0020' } },
    });
  });
});
