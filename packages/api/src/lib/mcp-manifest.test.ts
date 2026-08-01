import { describe, expect, it } from 'vitest';
import { manifestMcpCapabilities, manifestMcpConfig, mcpExecutionConfig, validateMcpManifest } from './mcp-manifest.js';

function manifest() {
  return {
    schemaVersion: '1',
    kind: 'mcp',
    name: 'Search MCP',
    slug: 'search-mcp',
    description: 'Search public sources through MCP.',
    server: {
      url: 'https://mcp.example.com/mcp',
      transport: 'streamable_http',
      auth: { mode: 'oauth2', instructionsUrl: 'https://mcp.example.com/docs/auth' },
    },
    features: {
      tools: [{ name: 'search', description: 'Search public sources.' }],
      resources: false,
      prompts: true,
    },
  };
}

describe('MCP manifest', () => {
  it('creates direct connection metadata without Markgit commerce', () => {
    const parsed = validateMcpManifest(manifest());
    expect(manifestMcpConfig(parsed).features.tools[0]?.name).toBe('search');
    expect(mcpExecutionConfig(parsed)).toMatchObject({ type: 'mcp_remote', transport: 'streamable_http' });
    expect(manifestMcpCapabilities(parsed)).toMatchObject({ openWorld: true, requiresUserCredential: true });
  });

  it('rejects insecure remote endpoints', () => {
    const input = manifest();
    input.server.url = 'http://mcp.example.com/mcp';
    expect(() => validateMcpManifest(input)).toThrow(/must use HTTPS/);
  });

  it('requires unique declared tool names', () => {
    const input = manifest();
    input.features.tools.push({ name: 'search', description: 'Duplicate.' });
    expect(() => validateMcpManifest(input)).toThrow(/unique valid name/);
  });
});
