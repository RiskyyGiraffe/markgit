import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { executions, products } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

interface ParamMapping {
  target: 'query' | 'body' | 'header';
  param: string;
}

interface StaticParam {
  target: 'query' | 'body' | 'header';
  param: string;
  value: string;
}

interface ExecutionConfig {
  type: 'http_rest';
  method: 'GET' | 'POST';
  baseUrl: string;
  timeoutMs?: number;
  paramMapping?: Record<string, ParamMapping>;
  staticParams?: StaticParam[];
}

interface InputSchema {
  required?: string[];
  [key: string]: unknown;
}

interface ExecutionResult {
  success: boolean;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
}

export async function runExecution(
  executionId: string,
  productId: string,
  input: Record<string, unknown>,
): Promise<ExecutionResult> {
  // Load product to get executionConfig
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

  // Validate required input fields
  const schema = product.inputSchema as InputSchema | null;
  if (schema?.required) {
    const missing = schema.required.filter((field) => !(field in input));
    if (missing.length > 0) {
      throw new ValidationError(`Missing required input fields: ${missing.join(', ')}`);
    }
  }

  // Mark execution as running
  await db
    .update(executions)
    .set({ status: 'running', startedAt: new Date(), input })
    .where(eq(executions.id, executionId));

  try {
    const output = await callUpstream(config, input);
    // Mark execution as completed
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

async function callUpstream(
  config: ExecutionConfig,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = new URL(config.baseUrl);
  const headers: Record<string, string> = {};
  const bodyParams: Record<string, unknown> = {};

  // Apply param mappings from input
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

  // Apply static params
  if (config.staticParams) {
    for (const sp of config.staticParams) {
      switch (sp.target) {
        case 'query':
          url.searchParams.set(sp.param, sp.value);
          break;
        case 'header':
          headers[sp.param] = sp.value;
          break;
        case 'body':
          bodyParams[sp.param] = sp.value;
          break;
      }
    }
  }

  const timeoutMs = config.timeoutMs ?? 30_000;
  const fetchOptions: RequestInit = {
    method: config.method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (config.method === 'POST' && Object.keys(bodyParams).length > 0) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(bodyParams);
  }

  const response = await fetch(url.toString(), fetchOptions);

  if (!response.ok) {
    throw new Error(`Upstream API returned ${response.status}: ${response.statusText}`);
  }

  return (await response.json()) as Record<string, unknown>;
}
