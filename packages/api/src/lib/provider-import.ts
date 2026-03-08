import { ValidationError } from './errors.js';

export type AuthMode = 'none' | 'provider_managed' | 'buyer_supplied';
export type AuthType = 'none' | 'bearer' | 'api_key' | 'basic';
export type AuthLocation = 'header' | 'query' | 'body';
export type ImportSourceType =
  | 'openapi_json'
  | 'openapi_yaml'
  | 'postman_collection'
  | 'html_docs'
  | 'unknown';
export type ImportRunStatus =
  | 'created'
  | 'fetching'
  | 'parsed'
  | 'review_ready'
  | 'test_ready'
  | 'test_passed'
  | 'test_failed'
  | 'published';

export interface ExecutionAuthConfig {
  mode: AuthMode;
  type: AuthType;
  location: AuthLocation;
  name: string;
  scheme?: string;
}

export interface ParamMapping {
  target: 'query' | 'body' | 'header';
  param: string;
}

export interface StaticParam {
  target: 'query' | 'body' | 'header';
  param: string;
  value: string;
}

export interface ExecutionConfig {
  type: 'http_rest';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  baseUrl: string;
  timeoutMs?: number;
  paramMapping?: Record<string, ParamMapping>;
  staticParams?: StaticParam[];
  auth: ExecutionAuthConfig;
}

export interface ProductDraft {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  pricePerCallUsd: string;
  tags: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  executionConfig: ExecutionConfig;
}

export interface ImportDraftPayload {
  docsUrl: string;
  baseUrl: string;
  authMode: AuthMode;
  draft?: Partial<ProductDraft>;
}

export interface TestCredentialPayload {
  value: string;
  authType: Exclude<AuthType, 'none'>;
  location: AuthLocation;
  name: string;
  scheme?: string;
}

export function slugifyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function normalizeAuthConfig(input: Partial<ExecutionAuthConfig> | undefined, mode: AuthMode) {
  if (mode === 'none') {
    return {
      mode,
      type: 'none' as const,
      location: 'header' as const,
      name: 'Authorization',
    };
  }

  if (!input?.type || input.type === 'none') {
    throw new ValidationError('Auth type is required for authenticated products');
  }

  if (!input.location || !input.name) {
    throw new ValidationError('Auth location and name are required for authenticated products');
  }

  return {
    mode,
    type: input.type,
    location: input.location,
    name: input.name,
    scheme: input.scheme,
  };
}

export function normalizeDraft(input: Partial<ProductDraft>, fallbackBaseUrl: string, authMode: AuthMode) {
  if (!input.name) {
    throw new ValidationError('Draft name is required');
  }

  const slug = input.slug?.trim() || slugifyName(input.name);
  if (!slug) {
    throw new ValidationError('Draft slug is required');
  }

  if (!input.executionConfig) {
    throw new ValidationError('Execution config is required');
  }

  const executionConfig = {
    ...input.executionConfig,
    baseUrl: input.executionConfig.baseUrl || fallbackBaseUrl,
    auth: normalizeAuthConfig(input.executionConfig.auth, authMode),
  } satisfies ExecutionConfig;

  return {
    name: input.name.trim(),
    slug,
    description: input.description?.trim(),
    category: input.category?.trim(),
    pricePerCallUsd: input.pricePerCallUsd ?? '0.2500',
    tags: input.tags ?? ['api'],
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    executionConfig,
  } satisfies ProductDraft;
}
