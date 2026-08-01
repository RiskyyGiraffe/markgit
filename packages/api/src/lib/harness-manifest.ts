import { ValidationError } from './errors.js';
import { normalizeOptionalLogoUrl } from './public-asset-url.js';
import { normalizeToolCapabilities, type ToolCapabilities } from './tool-policy.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MONEY_PATTERN = /^\d+(?:\.\d{1,4})?$/;
const ALLOWED_DATA_ACCESS = new Set(['read', 'write', 'read_write']);
const ALLOWED_COMPACTION_STRATEGIES = new Set(['summary', 'checkpoint', 'provider_managed']);
const ALLOWED_EXTERNAL_PRICING = new Set(['free', 'per_call', 'passed_through', 'unknown']);

export type HarnessExternalApi = {
  id: string;
  name: string;
  baseUrl: string;
  purpose: string;
  dataSent: string[];
  dataReceived: string[];
  pricing: {
    type: 'free' | 'per_call' | 'passed_through' | 'unknown';
    amountUsd?: string;
    note?: string;
  };
};

export type HarnessAccessManifest = {
  externalApis: HarnessExternalApi[];
  markgitTools: Array<{
    slug: string;
    purpose: string;
    maxCallsPerRun?: number;
    maxSpendUsdPerRun?: string;
  }>;
  data: Array<{
    id: string;
    type: 'user_input' | 'filesystem' | 'database' | 'secret' | 'network' | 'other';
    access: 'read' | 'write' | 'read_write';
    purpose: string;
    scope: string;
  }>;
  dataRetention: 'none' | 'transient' | 'stored';
};

export type HarnessConfig = {
  protocol: 'markgit.harness/v1';
  runtime: {
    startUrl: string;
    cancelUrl?: string;
    auth?: {
      mode: 'none' | 'provider_managed';
      type?: 'bearer' | 'api_key';
      location?: 'header';
      name?: string;
      scheme?: string;
    };
  };
  access: HarnessAccessManifest;
  loop: {
    maxSteps: number;
    maxRuntimeSeconds: number;
    heartbeatSeconds: number;
  };
  goal?: {
    inputField: string;
    completionField: string;
  };
  compaction: {
    supported: boolean;
    strategy: 'summary' | 'checkpoint' | 'provider_managed';
    maxContextTokens?: number;
    preserves: string[];
  };
  externalApiCosts: 'included' | 'user_supplied';
  pricingNote?: string;
};

export type HarnessManifest = {
  schemaVersion: '1';
  kind: 'harness';
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
  runtime: HarnessConfig['runtime'];
  goal?: HarnessConfig['goal'];
  inputSchema: Record<string, unknown> & { type: 'object' };
  outputSchema?: Record<string, unknown>;
  capabilities?: Partial<Omit<ToolCapabilities, 'declared'>>;
  access: HarnessAccessManifest;
  loop: HarnessConfig['loop'];
  compaction: HarnessConfig['compaction'];
  pricing: {
    externalApiCosts: HarnessConfig['externalApiCosts'];
    note?: string;
  };
};

function validateHttpsUrl(raw: string, field: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError(`${field} must be a valid URL`);
  }
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
    throw new ValidationError(`${field} must use HTTPS (HTTP is allowed for localhost)`);
  }
  if (url.username || url.password) {
    throw new ValidationError(`${field} must not contain credentials`);
  }
  return url;
}

function requireStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new ValidationError(`${field} must be an array of non-empty strings`);
  }
}

function positiveInteger(value: unknown, field: string, maximum: number) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new ValidationError(`${field} must be an integer from 1 to ${maximum}`);
  }
}

export function validateHarnessManifest(value: unknown): HarnessManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Harness manifest must be a JSON object');
  }
  const manifest = value as Partial<HarnessManifest>;
  if (manifest.schemaVersion !== '1') throw new ValidationError('schemaVersion must be "1"');
  if (manifest.kind !== 'harness') throw new ValidationError('kind must be "harness"');
  if (!manifest.name?.trim() || manifest.name.length > 255) {
    throw new ValidationError('name is required and must be at most 255 characters');
  }
  if (!manifest.slug || !SLUG_PATTERN.test(manifest.slug) || manifest.slug.length > 255) {
    throw new ValidationError('slug must contain lowercase letters, numbers, and single hyphens');
  }
  if (!manifest.description?.trim()) throw new ValidationError('description is required');
  if (manifest.logoUrl) manifest.logoUrl = normalizeOptionalLogoUrl(manifest.logoUrl);
  if (manifest.inputSchema?.type !== 'object') {
    throw new ValidationError('inputSchema must be a JSON Schema object with type "object"');
  }
  if (!manifest.runtime?.startUrl) throw new ValidationError('runtime.startUrl is required');
  validateHttpsUrl(manifest.runtime.startUrl, 'runtime.startUrl');
  if (manifest.runtime.cancelUrl) validateHttpsUrl(manifest.runtime.cancelUrl, 'runtime.cancelUrl');
  const runtimeAuth = manifest.runtime.auth ?? { mode: 'none' as const };
  if (!['none', 'provider_managed'].includes(runtimeAuth.mode)) {
    throw new ValidationError('runtime.auth.mode must be none or provider_managed');
  }
  if (runtimeAuth.mode === 'provider_managed') {
    if (!['bearer', 'api_key'].includes(String(runtimeAuth.type)) || runtimeAuth.location !== 'header' || !runtimeAuth.name?.trim()) {
      throw new ValidationError('provider-managed loop auth requires type, header location, and header name');
    }
  }
  manifest.runtime.auth = runtimeAuth;

  if (!manifest.access || !Array.isArray(manifest.access.externalApis)
    || !Array.isArray(manifest.access.markgitTools) || !Array.isArray(manifest.access.data)) {
    throw new ValidationError('access must explicitly declare externalApis, markgitTools, and data arrays');
  }
  if (!['none', 'transient', 'stored'].includes(manifest.access.dataRetention)) {
    throw new ValidationError('access.dataRetention must be none, transient, or stored');
  }
  const externalIds = new Set<string>();
  const outboundDomains = new Set<string>();
  for (const api of manifest.access.externalApis) {
    if (!api?.id || !IDENTIFIER_PATTERN.test(api.id) || externalIds.has(api.id)) {
      throw new ValidationError('Every external API must have a unique lowercase id');
    }
    externalIds.add(api.id);
    if (!api.name?.trim() || !api.purpose?.trim()) {
      throw new ValidationError(`External API ${api.id} requires name and purpose`);
    }
    const apiUrl = validateHttpsUrl(api.baseUrl, `access.externalApis.${api.id}.baseUrl`);
    outboundDomains.add(apiUrl.hostname.toLowerCase());
    requireStringArray(api.dataSent, `access.externalApis.${api.id}.dataSent`);
    requireStringArray(api.dataReceived, `access.externalApis.${api.id}.dataReceived`);
    if (!api.pricing || !ALLOWED_EXTERNAL_PRICING.has(api.pricing.type)) {
      throw new ValidationError(`External API ${api.id} must declare pricing.type`);
    }
    if (api.pricing.type === 'per_call') {
      if (!api.pricing.amountUsd || !MONEY_PATTERN.test(api.pricing.amountUsd)) {
        throw new ValidationError(`External API ${api.id} per-call pricing requires amountUsd`);
      }
    }
  }
  for (const tool of manifest.access.markgitTools) {
    if (!tool?.slug || !SLUG_PATTERN.test(tool.slug) || !tool.purpose?.trim()) {
      throw new ValidationError('Every Markgit tool access entry requires a valid slug and purpose');
    }
    if (tool.maxCallsPerRun === undefined || tool.maxSpendUsdPerRun === undefined) {
      throw new ValidationError(`markgitTools.${tool.slug} requires maxCallsPerRun and maxSpendUsdPerRun`);
    }
    positiveInteger(tool.maxCallsPerRun, `markgitTools.${tool.slug}.maxCallsPerRun`, 100_000);
    if (!MONEY_PATTERN.test(tool.maxSpendUsdPerRun)) {
      throw new ValidationError(`markgitTools.${tool.slug}.maxSpendUsdPerRun must be a USD amount with at most four decimals`);
    }
  }
  for (const resource of manifest.access.data) {
    if (!resource?.id || !IDENTIFIER_PATTERN.test(resource.id) || !resource.purpose?.trim()
      || !resource.scope?.trim() || !ALLOWED_DATA_ACCESS.has(resource.access)) {
      throw new ValidationError('Every data access entry requires id, type, access, purpose, and scope');
    }
  }

  if (!manifest.loop) throw new ValidationError('loop limits are required');
  positiveInteger(manifest.loop.maxSteps, 'loop.maxSteps', 1_000_000);
  positiveInteger(manifest.loop.maxRuntimeSeconds, 'loop.maxRuntimeSeconds', 2_592_000);
  positiveInteger(manifest.loop.heartbeatSeconds, 'loop.heartbeatSeconds', 86_400);
  if (manifest.goal) {
    if (!manifest.goal.inputField?.trim() || !manifest.goal.completionField?.trim()) {
      throw new ValidationError('goal requires inputField and completionField');
    }
    const properties = manifest.inputSchema.properties as Record<string, unknown> | undefined;
    if (!properties || !(manifest.goal.inputField in properties)) {
      throw new ValidationError('goal.inputField must reference an inputSchema property');
    }
  }
  if (!manifest.compaction || !ALLOWED_COMPACTION_STRATEGIES.has(manifest.compaction.strategy)) {
    throw new ValidationError('compaction must declare supported and a valid strategy');
  }
  if (typeof manifest.compaction.supported !== 'boolean') {
    throw new ValidationError('compaction.supported must be boolean');
  }
  if (!manifest.compaction.supported && manifest.compaction.strategy !== 'provider_managed') {
    throw new ValidationError('Unsupported compaction must use provider_managed strategy');
  }
  if (manifest.compaction.maxContextTokens !== undefined) {
    positiveInteger(manifest.compaction.maxContextTokens, 'compaction.maxContextTokens', 100_000_000);
  }
  requireStringArray(manifest.compaction.preserves, 'compaction.preserves');

  const pricing = manifest.pricing;
  if (!pricing || !['included', 'user_supplied'].includes(pricing.externalApiCosts)) {
    throw new ValidationError('pricing.externalApiCosts must be included or user_supplied; unbounded pass-through billing is not supported');
  }
  if (manifest.tags) requireStringArray(manifest.tags, 'tags');
  if (manifest.provider && !manifest.provider.name?.trim()) {
    throw new ValidationError('provider.name is required when provider metadata is included');
  }

  normalizeToolCapabilities({
    ...manifest.capabilities,
    openWorld: outboundDomains.size > 0 || manifest.capabilities?.openWorld === true,
    allowedOutboundDomains: [...outboundDomains],
    dataRetention: manifest.access.dataRetention,
  }, { baseUrl: manifest.runtime.startUrl, auth: { mode: manifest.runtime.auth?.mode ?? 'none' } });

  return manifest as HarnessManifest;
}

export function manifestHarnessConfig(manifest: HarnessManifest): HarnessConfig {
  return {
    protocol: 'markgit.harness/v1',
    runtime: manifest.runtime,
    access: manifest.access,
    loop: manifest.loop,
    goal: manifest.goal,
    compaction: manifest.compaction,
    externalApiCosts: manifest.pricing.externalApiCosts,
    pricingNote: manifest.pricing.note,
  };
}

export function manifestHarnessCapabilities(manifest: HarnessManifest) {
  return normalizeToolCapabilities({
    ...manifest.capabilities,
    openWorld: manifest.access.externalApis.length > 0 || manifest.capabilities?.openWorld === true,
    allowedOutboundDomains: manifest.access.externalApis.map((api) => new URL(api.baseUrl).hostname.toLowerCase()),
    dataRetention: manifest.access.dataRetention,
  }, { baseUrl: manifest.runtime.startUrl, auth: { mode: manifest.runtime.auth?.mode ?? 'none' } });
}

export function harnessExecutionConfig(manifest: HarnessManifest) {
  return {
    type: 'harness_http',
    protocol: 'markgit.harness/v1',
    baseUrl: manifest.runtime.startUrl,
    startUrl: manifest.runtime.startUrl,
    cancelUrl: manifest.runtime.cancelUrl,
    method: 'POST',
    auth: manifest.runtime.auth?.mode === 'provider_managed'
      ? {
          mode: 'provider_managed',
          type: manifest.runtime.auth.type,
          location: 'header',
          name: manifest.runtime.auth.name,
          scheme: manifest.runtime.auth.scheme,
        }
      : { mode: 'none', type: 'none', location: 'header', name: 'Authorization' },
  };
}

export function validateHarnessEventAccess(
  access: HarnessAccessManifest,
  eventType: string,
  data: Record<string, unknown>,
) {
  if (eventType === 'external_api.call') {
    const declared = access.externalApis.find((api) => api.id === data.apiId);
    if (!declared) {
      throw new ValidationError('external_api.call must reference an API declared in the frozen access manifest');
    }
    if (typeof data.operation !== 'string' || !data.operation.trim()) {
      throw new ValidationError('external_api.call requires an operation');
    }
    return {
      ...data,
      declaredApi: {
        id: declared.id,
        name: declared.name,
        baseUrl: declared.baseUrl,
        purpose: declared.purpose,
        dataSent: declared.dataSent,
        dataReceived: declared.dataReceived,
        pricing: declared.pricing,
      },
    };
  }
  if (eventType === 'markgit_tool.call' || eventType === 'markgit_tool.reserved') {
    if (!access.markgitTools.some((tool) => tool.slug === data.slug)) {
      throw new ValidationError('markgit_tool.call must reference a tool declared in the frozen access manifest');
    }
  }
  return data;
}
