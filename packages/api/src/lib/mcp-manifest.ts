import { ValidationError } from './errors.js';
import { normalizeOptionalLogoUrl } from './public-asset-url.js';
import { normalizeToolCapabilities, type ToolCapabilities } from './tool-policy.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.:-]+$/;

export type McpTransport = 'streamable_http' | 'sse';
export type McpAuthMode = 'none' | 'oauth2' | 'user_supplied';

export type McpManifest = {
  schemaVersion: '1';
  kind: 'mcp';
  name: string;
  slug: string;
  logoUrl?: string;
  description: string;
  category?: string;
  tags?: string[];
  provider?: { name: string; description?: string; websiteUrl?: string };
  source?: {
    publisher?: string;
    repositoryUrl: string;
    url: string;
    revision: string;
    path?: string;
    registryName?: string;
    registryVersion?: string;
    registryUrl?: string;
  };
  server: {
    url: string;
    transport: McpTransport;
    auth: { mode: McpAuthMode; instructionsUrl?: string };
  };
  features: {
    tools: Array<{ name: string; description?: string }>;
    resources: boolean;
    prompts: boolean;
  };
  capabilities?: Partial<Omit<ToolCapabilities, 'declared'>>;
};

export type McpConfig = {
  protocol: 'mcp';
  server: McpManifest['server'];
  features: McpManifest['features'];
  source?: McpManifest['source'];
};

function httpsUrl(raw: string, field: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError(`${field} must be a valid URL`);
  }
  const localhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
    throw new ValidationError(`${field} must use HTTPS (HTTP is allowed for localhost)`);
  }
  if (url.username || url.password) throw new ValidationError(`${field} must not contain credentials`);
  return url;
}

export function validateMcpManifest(value: unknown): McpManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('MCP manifest must be a JSON object');
  }
  const manifest = value as Partial<McpManifest>;
  if (manifest.schemaVersion !== '1') throw new ValidationError('schemaVersion must be "1"');
  if (manifest.kind !== 'mcp') throw new ValidationError('kind must be "mcp"');
  if (!manifest.name?.trim() || manifest.name.length > 255) {
    throw new ValidationError('name is required and must be at most 255 characters');
  }
  if (!manifest.slug || !SLUG_PATTERN.test(manifest.slug) || manifest.slug.length > 255) {
    throw new ValidationError('slug must contain lowercase letters, numbers, and single hyphens');
  }
  if (!manifest.description?.trim()) throw new ValidationError('description is required');
  if (manifest.logoUrl) manifest.logoUrl = normalizeOptionalLogoUrl(manifest.logoUrl);
  if (!manifest.server || !['streamable_http', 'sse'].includes(String(manifest.server.transport))) {
    throw new ValidationError('server.transport must be streamable_http or sse');
  }
  const serverUrl = httpsUrl(manifest.server.url, 'server.url');
  if (!manifest.server.auth || !['none', 'oauth2', 'user_supplied'].includes(String(manifest.server.auth.mode))) {
    throw new ValidationError('server.auth.mode must be none, oauth2, or user_supplied');
  }
  if (manifest.server.auth.instructionsUrl) {
    httpsUrl(manifest.server.auth.instructionsUrl, 'server.auth.instructionsUrl');
  }
  if (!manifest.features || !Array.isArray(manifest.features.tools)
    || typeof manifest.features.resources !== 'boolean' || typeof manifest.features.prompts !== 'boolean') {
    throw new ValidationError('features must declare tools, resources, and prompts');
  }
  const names = new Set<string>();
  for (const tool of manifest.features.tools) {
    if (!tool?.name || !TOOL_NAME_PATTERN.test(tool.name) || names.has(tool.name)) {
      throw new ValidationError('Every MCP tool must have a unique valid name');
    }
    names.add(tool.name);
    if (tool.description !== undefined && typeof tool.description !== 'string') {
      throw new ValidationError(`MCP tool ${tool.name} description must be a string`);
    }
  }
  if (manifest.tags && (!Array.isArray(manifest.tags) || manifest.tags.some((tag) => typeof tag !== 'string' || !tag.trim()))) {
    throw new ValidationError('tags must be an array of non-empty strings');
  }
  if (manifest.provider && !manifest.provider.name?.trim()) {
    throw new ValidationError('provider.name is required when provider metadata is included');
  }
  if (manifest.source) {
    manifest.source.repositoryUrl = httpsUrl(manifest.source.repositoryUrl, 'source.repositoryUrl').toString();
    manifest.source.url = httpsUrl(manifest.source.url, 'source.url').toString();
    if (manifest.source.registryUrl) manifest.source.registryUrl = httpsUrl(manifest.source.registryUrl, 'source.registryUrl').toString();
    if (!manifest.source.revision?.trim() || manifest.source.revision.length > 255) {
      throw new ValidationError('source.revision is required and must be at most 255 characters');
    }
    if (manifest.source.path && (manifest.source.path.startsWith('/') || manifest.source.path.split('/').includes('..'))) {
      throw new ValidationError('source.path must be repository-relative');
    }
  }
  normalizeToolCapabilities({
    readOnly: true,
    openWorld: true,
    seesUntrustedContent: true,
    requiresUserCredential: manifest.server.auth.mode !== 'none',
    dataRetention: 'unknown',
    ...manifest.capabilities,
    allowedOutboundDomains: [
      serverUrl.hostname.toLowerCase(),
      ...(manifest.capabilities?.allowedOutboundDomains ?? []),
    ],
  }, mcpExecutionConfig(manifest as McpManifest));
  return manifest as McpManifest;
}

export function manifestMcpConfig(manifest: McpManifest): McpConfig {
  return { protocol: 'mcp', server: manifest.server, features: manifest.features, ...(manifest.source ? { source: manifest.source } : {}) };
}

export function manifestMcpCapabilities(manifest: McpManifest) {
  const hostname = new URL(manifest.server.url).hostname.toLowerCase();
  return normalizeToolCapabilities({
    readOnly: true,
    openWorld: true,
    seesUntrustedContent: true,
    requiresUserCredential: manifest.server.auth.mode !== 'none',
    dataRetention: 'unknown',
    ...manifest.capabilities,
    allowedOutboundDomains: [hostname, ...(manifest.capabilities?.allowedOutboundDomains ?? [])],
  }, mcpExecutionConfig(manifest));
}

export function mcpExecutionConfig(manifest: McpManifest) {
  return {
    type: 'mcp_remote',
    protocol: 'mcp',
    method: 'POST',
    baseUrl: manifest.server.url,
    transport: manifest.server.transport,
    auth: {
      mode: manifest.server.auth.mode,
      type: manifest.server.auth.mode === 'none' ? 'none' : 'bearer',
      location: 'header',
      name: 'Authorization',
    },
  };
}
