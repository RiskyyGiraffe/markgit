import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { executions, products } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { ExecutionConfig } from '../lib/provider-import.js';
import { getExecutionCredential, type CredentialPayload } from './credentials.js';

interface InputSchema {
  required?: string[];
  [key: string]: unknown;
}

type RuntimeCredential = CredentialPayload;

interface ExecutionResult {
  success: boolean;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
}

function validateRequiredInput(schema: InputSchema | null, input: Record<string, unknown>) {
  if (!schema?.required) return;
  const missing = schema.required.filter((field) => !(field in input));
  if (missing.length > 0) {
    throw new ValidationError(`Missing required input fields: ${missing.join(', ')}`);
  }
}

function applyCredential(
  config: ExecutionConfig,
  url: URL,
  headers: Record<string, string>,
  bodyParams: Record<string, unknown>,
  credential: RuntimeCredential | null,
) {
  if (!credential) return;

  const resolvedValue =
    credential.authType === 'bearer'
      ? `${config.auth.scheme ?? 'Bearer'} ${credential.value}`
      : credential.authType === 'basic'
        ? `${config.auth.scheme ?? 'Basic'} ${credential.value}`
        : credential.value;

  switch (credential.location) {
    case 'query':
      url.searchParams.set(credential.name, resolvedValue);
      break;
    case 'body':
      bodyParams[credential.name] = resolvedValue;
      break;
    case 'header':
    default:
      headers[credential.name] = resolvedValue;
      break;
  }
}

async function callUpstream(
  config: ExecutionConfig,
  input: Record<string, unknown>,
  credential: RuntimeCredential | null,
): Promise<Record<string, unknown>> {
  const url = new URL(config.baseUrl);
  const headers: Record<string, string> = {};
  const bodyParams: Record<string, unknown> = {};

  if (config.paramMapping) {
    for (const [inputField, mapping] of Object.entries(config.paramMapping)) {
      const value = input[inputField];
      if (value === undefined) continue;

      switch (mapping.target) {
        case 'query':
          url.searchParams.set(mapping.param, String(value));
          break;
        case 'header':
          headers[mapping.param] = String(value);
          break;
        case 'body':
          bodyParams[mapping.param] = value;
          break;
      }
    }
  }

  if (config.staticParams) {
    for (const param of config.staticParams) {
      switch (param.target) {
        case 'query':
          url.searchParams.set(param.param, param.value);
          break;
        case 'header':
          headers[param.param] = param.value;
          break;
        case 'body':
          bodyParams[param.param] = param.value;
          break;
      }
    }
  }

  applyCredential(config, url, headers, bodyParams, credential);

  const timeoutMs = config.timeoutMs ?? 30_000;
  const method = config.method ?? 'GET';
  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (method !== 'GET' && Object.keys(bodyParams).length > 0) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(bodyParams);
  }

  const response = await fetch(url.toString(), fetchOptions);
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Upstream API returned ${response.status}: ${text || response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as Record<string, unknown>;
  }

  return {
    status: response.status,
    text: await response.text(),
  };
}

export async function runAdhocExecution(
  config: ExecutionConfig,
  input: Record<string, unknown>,
  credential?: RuntimeCredential | null,
): Promise<ExecutionResult> {
  try {
    const output = await callUpstream(config, input, credential ?? null);
    return { success: true, output, errorMessage: null };
  } catch (err) {
    return {
      success: false,
      output: null,
      errorMessage: err instanceof Error ? err.message : 'Unknown execution error',
    };
  }
}

export async function runExecution(
  executionId: string,
  productId: string,
  userId: string,
  input: Record<string, unknown>,
): Promise<ExecutionResult> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new NotFoundError('Product');

  const config = product.executionConfig as ExecutionConfig | null;
  if (!config || config.type !== 'http_rest') {
    throw new ValidationError('Product does not have a valid execution config');
  }

  validateRequiredInput(product.inputSchema as InputSchema | null, input);

  await db
    .update(executions)
    .set({ status: 'running', startedAt: new Date(), input })
    .where(eq(executions.id, executionId));

  try {
    const credential = await getExecutionCredential(
      userId,
      product.id,
      product.providerId,
      config.auth.mode,
    );
    const output = await callUpstream(config, input, credential);
    await db
      .update(executions)
      .set({ status: 'completed', output, completedAt: new Date() })
      .where(eq(executions.id, executionId));
    return { success: true, output, errorMessage: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';
    await db
      .update(executions)
      .set({ status: 'failed', errorMessage, completedAt: new Date() })
      .where(eq(executions.id, executionId));

    return { success: false, output: null, errorMessage };
  }
}
