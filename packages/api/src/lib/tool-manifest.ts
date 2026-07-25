import { ValidationError } from './errors.js';
import { normalizeOptionalLogoUrl } from './public-asset-url.js';

export type ToolManifest = {
  schemaVersion: '1';
  name: string;
  slug: string;
  logoUrl?: string;
  description: string;
  category?: string;
  tags?: string[];
  provider?: {
    name: string;
    description?: string;
    websiteUrl?: string;
  };
  endpoint: {
    url: string;
    method: 'GET' | 'POST';
  };
  inputSchema: Record<string, unknown> & { type: 'object' };
  outputSchema?: Record<string, unknown>;
  pricing: {
    amountPerCallUsd: string;
  };
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONEY_PATTERN = /^\d+(?:\.\d{1,4})?$/;

export function validateToolManifest(value: unknown): ToolManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Tool manifest must be a JSON object');
  }

  const manifest = value as Partial<ToolManifest>;
  if (manifest.schemaVersion !== '1') {
    throw new ValidationError('schemaVersion must be "1"');
  }
  if (!manifest.name?.trim() || manifest.name.length > 255) {
    throw new ValidationError('name is required and must be at most 255 characters');
  }
  if (!manifest.slug || !SLUG_PATTERN.test(manifest.slug) || manifest.slug.length > 255) {
    throw new ValidationError('slug must contain lowercase letters, numbers, and single hyphens');
  }
  if (!manifest.description?.trim()) {
    throw new ValidationError('description is required');
  }
  if (manifest.logoUrl) {
    manifest.logoUrl = normalizeOptionalLogoUrl(manifest.logoUrl);
  }
  if (!manifest.endpoint || !['GET', 'POST'].includes(manifest.endpoint.method)) {
    throw new ValidationError('endpoint.method must be GET or POST');
  }

  let endpoint: URL;
  try {
    endpoint = new URL(manifest.endpoint.url);
  } catch {
    throw new ValidationError('endpoint.url must be a valid URL');
  }
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && isLocalhost)) {
    throw new ValidationError('endpoint.url must use HTTPS (HTTP is allowed for localhost)');
  }
  if (manifest.inputSchema?.type !== 'object') {
    throw new ValidationError('inputSchema must be a JSON Schema object with type "object"');
  }

  const amount = manifest.pricing?.amountPerCallUsd;
  if (!amount || !MONEY_PATTERN.test(amount) || parseFloat(amount) < 0) {
    throw new ValidationError('pricing.amountPerCallUsd must be a non-negative USD amount with at most 4 decimals');
  }
  if (manifest.tags && (!Array.isArray(manifest.tags) || manifest.tags.some((tag) => typeof tag !== 'string'))) {
    throw new ValidationError('tags must be an array of strings');
  }
  if (manifest.provider && !manifest.provider.name?.trim()) {
    throw new ValidationError('provider.name is required when provider metadata is included');
  }

  return manifest as ToolManifest;
}

export function manifestExecutionConfig(manifest: ToolManifest) {
  const properties = manifest.inputSchema.properties;
  const inputFields = properties && typeof properties === 'object' && !Array.isArray(properties)
    ? Object.keys(properties)
    : [];
  const target = manifest.endpoint.method === 'GET' ? 'query' : 'body';

  return {
    type: 'http_rest',
    protocol: 'markgit.tool/v1',
    method: manifest.endpoint.method,
    baseUrl: manifest.endpoint.url,
    auth: {
      mode: 'none',
      type: 'none',
      location: 'header',
      name: 'Authorization',
    },
    paramMapping: Object.fromEntries(
      inputFields.map((field) => [field, { target, param: field }]),
    ),
  };
}
