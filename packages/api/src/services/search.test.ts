import { describe, expect, it } from 'vitest';
import { buildSearchableText, lexicalSearchScore } from './search.js';
import { buildProductEmbeddingText } from './embeddings.js';

const item = {
  name: 'Structured Weather', slug: 'structured-weather', kind: 'tool',
  description: 'Current conditions', category: 'data', tags: ['forecast'],
  inputSchema: { properties: { city: { type: 'string' } } },
  outputSchema: { properties: { precipitationProbability: { type: 'number' } } },
  executionConfig: { method: 'GET' }, harnessConfig: null,
  mcpConfig: null, skillConfig: null,
  sourceMetadata: { markdown: 'Returns hourly rain chance and UV index.' },
  capabilities: { readOnly: true },
};

describe('universal search documents', () => {
  it('matches return fields and ingested documentation, not only names', () => {
    expect(buildSearchableText(item)).toContain('precipitationprobability');
    expect(lexicalSearchScore('hourly rain chance', item)).toBeGreaterThan(0);
  });

  it('embeds schemas, kind-specific configs, and source markdown', () => {
    const text = buildProductEmbeddingText(item);
    expect(text).toContain('outputs, return value, and returned data');
    expect(text).toContain('precipitationProbability');
    expect(text).toContain('hourly rain chance');
  });
});
