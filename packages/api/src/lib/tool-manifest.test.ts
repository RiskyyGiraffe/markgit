import { describe, expect, it } from 'vitest';
import { manifestExecutionConfig, validateToolManifest } from './tool-manifest.js';

const validManifest = {
  schemaVersion: '1',
  name: 'Weather lookup',
  slug: 'weather-lookup',
  description: 'Returns the current weather for a city.',
  endpoint: { url: 'https://tools.example.com/weather', method: 'POST' },
  inputSchema: {
    type: 'object',
    required: ['city'],
    properties: { city: { type: 'string' } },
  },
  pricing: { amountPerCallUsd: '0.0100' },
} as const;

describe('tool manifest', () => {
  it('accepts the minimal hosted-tool contract', () => {
    expect(validateToolManifest(validManifest)).toEqual(validManifest);
  });

  it('compiles schema properties into deterministic request mappings', () => {
    expect(manifestExecutionConfig(validateToolManifest(validManifest))).toMatchObject({
      protocol: 'markgit.tool/v1',
      method: 'POST',
      paramMapping: { city: { target: 'body', param: 'city' } },
    });
  });

  it('rejects insecure public endpoints', () => {
    expect(() => validateToolManifest({
      ...validManifest,
      endpoint: { ...validManifest.endpoint, url: 'http://tools.example.com/weather' },
    })).toThrow('must use HTTPS');
  });

  it('accepts a secure publisher logo and normalizes it', () => {
    expect(validateToolManifest({
      ...validManifest,
      logoUrl: 'https://cdn.example.com/weather.svg',
    }).logoUrl).toBe('https://cdn.example.com/weather.svg');
  });

  it('rejects unsafe logo URLs', () => {
    expect(() => validateToolManifest({
      ...validManifest,
      logoUrl: 'javascript:alert(1)',
    })).toThrow('logoUrl must use HTTPS');
    expect(() => validateToolManifest({
      ...validManifest,
      logoUrl: 'https://token:secret@cdn.example.com/weather.svg',
    })).toThrow('must not contain credentials');
  });
});
