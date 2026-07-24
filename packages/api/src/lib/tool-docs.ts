type JsonSchema = Record<string, unknown>;

export type ToolUsageSummary = {
  count: number;
  uniqueUsers: number;
  tracked: true;
  coverage: 'markgit_calls';
  invocationsLabel: string;
  usersLabel: string;
};

type DocumentedTool = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  provider: { id: string; name: string; trustTier: string };
  pricing: { type: 'free' | 'per_call'; currency: 'USD'; amount: string };
  usage: ToolUsageSummary;
  inputSchema: JsonSchema | null;
  outputSchema: JsonSchema | null;
  access:
    | { mode: 'direct'; endpoint: { url: string; method: 'GET' | 'POST' } }
    | { mode: 'gateway'; endpoint: { path: string; method: 'POST' } };
  updatedAt: Date | string;
};

function compactCount(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function buildUsageSummary(invocations: number, uniqueUsers: number): ToolUsageSummary {
  return {
    count: invocations,
    uniqueUsers,
    tracked: true,
    coverage: 'markgit_calls',
    invocationsLabel: invocations < 1_000
      ? 'Under 1K invokes'
      : `${compactCount(invocations)} invokes`,
    usersLabel: uniqueUsers < 100
      ? 'Under 100 users'
      : `${compactCount(uniqueUsers)} users`,
  };
}

export function exampleFromSchema(schema: JsonSchema | null | undefined): unknown {
  if (!schema) return {};
  if ('example' in schema) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length > 0) return schema.examples[0];
  if ('default' in schema) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case 'object': {
      const properties = schema.properties && typeof schema.properties === 'object'
        ? schema.properties as Record<string, JsonSchema>
        : {};
      return Object.fromEntries(
        Object.entries(properties).slice(0, 12).map(([key, value]) => [key, exampleFromSchema(value)]),
      );
    }
    case 'array':
      return [exampleFromSchema(schema.items as JsonSchema | undefined)];
    case 'integer':
      return 1;
    case 'number':
      return 1.5;
    case 'boolean':
      return true;
    case 'string':
      if (schema.format === 'date-time') return '2026-01-01T00:00:00Z';
      if (schema.format === 'date') return '2026-01-01';
      if (schema.format === 'uri') return 'https://example.com';
      return 'string';
    default:
      return null;
  }
}

export function buildToolDocumentation(tool: DocumentedTool, origin: string) {
  const toolPath = `/v1/registry/tools/${encodeURIComponent(tool.slug)}`;
  const callPath = `/v1/tools/${encodeURIComponent(tool.slug)}/call`;
  const quotePath = `/v1/tools/${encodeURIComponent(tool.slug)}/quote`;
  const inputExample = exampleFromSchema(tool.inputSchema);
  const outputExample = exampleFromSchema(tool.outputSchema);

  return {
    schemaVersion: 'markgit.tool-docs/v1',
    tool: {
      id: tool.id,
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      tags: tool.tags,
      provider: tool.provider,
      pricing: tool.pricing,
      usage: tool.usage,
      updatedAt: tool.updatedAt,
    },
    documentation: {
      metadata: `${origin}${toolPath}`,
      json: `${origin}${toolPath}/docs`,
      openapi: `${origin}${toolPath}/openapi.json`,
      llms: `${origin}${toolPath}/llms.txt`,
    },
    invocation: {
      flow: [
        `POST ${quotePath} to receive the exact price and spend-control decision.`,
        `Obtain user approval for quote.totalUsd unless an existing policy already permits it.`,
        `POST ${callPath} with the approved quote ID, input object, Bearer API key, and a unique Idempotency-Key.`,
      ],
      quote: {
        method: 'POST',
        url: `${origin}${quotePath}`,
        authentication: 'Bearer API key',
        requestBody: {},
        responseSchema: {
          type: 'object',
          required: ['quote', 'tool', 'controls'],
          properties: {
            quote: {
              type: 'object',
              required: ['id', 'priceUsd', 'feeUsd', 'totalUsd', 'expiresAt'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                priceUsd: { type: 'string' },
                feeUsd: { type: 'string' },
                totalUsd: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
              },
            },
            controls: {
              type: 'object',
              properties: {
                approved: { type: 'boolean' },
                violations: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      call: {
        method: 'POST',
        url: `${origin}${callPath}`,
        authentication: 'Bearer API key',
        requiredHeaders: {
          Authorization: 'Bearer mkgt_...',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'A unique value for this logical call',
        },
        requestSchema: {
          type: 'object',
          required: ['quoteId', 'input'],
          properties: {
            quoteId: { type: 'string', format: 'uuid' },
            input: tool.inputSchema ?? { type: 'object' },
          },
        },
        requestExample: { quoteId: 'approved-quote-id', input: inputExample },
        responseSchema: {
          type: 'object',
          required: ['id', 'tool', 'status', 'cost', 'output', 'error'],
          properties: {
            id: { type: 'string', description: 'Execution identifier' },
            tool: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                slug: { const: tool.slug },
                name: { const: tool.name },
              },
            },
            status: { type: 'string', enum: ['completed', 'failed'] },
            cost: {
              type: 'object',
              properties: {
                priceUsd: { type: 'string' },
                feeUsd: { type: 'string' },
                totalUsd: { type: 'string' },
                currency: { const: 'USD' },
              },
            },
            output: tool.outputSchema ?? {},
            error: {
              anyOf: [
                { type: 'null' },
                { type: 'object', properties: { message: { type: 'string' } } },
              ],
            },
          },
        },
        responseExample: {
          id: 'execution-id',
          tool: { id: tool.id, slug: tool.slug, name: tool.name },
          status: 'completed',
          cost: {
            priceUsd: tool.pricing.amount,
            feeUsd: tool.pricing.type === 'free' ? '0.0000' : 'calculated at quote time',
            totalUsd: tool.pricing.type === 'free' ? '0.0000' : 'returned by the approved quote',
            currency: 'USD',
          },
          output: outputExample,
          error: null,
        },
      },
      direct: tool.access.mode === 'direct' ? {
        note: 'This free provider-hosted endpoint can be called directly. Direct calls outside Markgit are not included in Markgit usage metrics.',
        method: tool.access.endpoint.method,
        url: tool.access.endpoint.url,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      } : null,
    },
  };
}

export function buildToolOpenApi(tool: DocumentedTool, origin: string) {
  const docs = buildToolDocumentation(tool, origin);
  const call = docs.invocation.call;
  const quote = docs.invocation.quote;
  const callPath = new URL(call.url).pathname;
  const quotePath = new URL(quote.url).pathname;

  return {
    openapi: '3.1.0',
    info: {
      title: `${tool.name} — Markgit`,
      version: '1.0.0',
      description: tool.description ?? `Call ${tool.name} through Markgit.`,
    },
    servers: [{ url: origin }],
    paths: {
      [quotePath]: {
        post: {
          operationId: `quote_${tool.slug.replace(/-/g, '_')}`,
          summary: `Get an exact quote for ${tool.name}`,
          security: [{ bearerAuth: [] }],
          responses: {
            '201': {
              description: 'Exact quote and policy decision',
              content: { 'application/json': { schema: quote.responseSchema } },
            },
          },
        },
      },
      [callPath]: {
        post: {
          operationId: `call_${tool.slug.replace(/-/g, '_')}`,
          summary: `Call ${tool.name}`,
          security: [{ bearerAuth: [] }],
          parameters: [{
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: call.requestSchema } },
          },
          responses: {
            '200': {
              description: 'Normalized tool result',
              content: { 'application/json': { schema: call.responseSchema } },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Markgit API key' },
      },
    },
    'x-markgit': {
      tool: { id: tool.id, slug: tool.slug },
      pricing: tool.pricing,
      usage: tool.usage,
      directEndpoint: tool.access.mode === 'direct' ? tool.access.endpoint : null,
    },
  };
}

export function buildToolLlmsText(tool: DocumentedTool, origin: string) {
  const docs = buildToolDocumentation(tool, origin);
  const direct = docs.invocation.direct
    ? `\n## Optional direct endpoint\n\n- ${docs.invocation.direct.method} ${docs.invocation.direct.url}\n- Direct calls are not included in Markgit usage metrics.\n`
    : '';

  return `# ${tool.name}\n\n> ${tool.description ?? 'No description provided.'}\n\n- Tool ID: ${tool.id}\n- Slug: ${tool.slug}\n- Provider: ${tool.provider.name} (${tool.provider.trustTier})\n- Price: ${tool.pricing.type === 'free' ? 'Free' : `$${tool.pricing.amount} USD per call before the displayed Markgit fee`}\n- Usage: ${tool.usage.invocationsLabel}; ${tool.usage.usersLabel}\n- JSON docs: ${docs.documentation.json}\n- OpenAPI 3.1: ${docs.documentation.openapi}\n\n## Required call flow\n\n1. POST ${docs.invocation.quote.url} with a Bearer API key.\n2. Confirm controls.approved and obtain approval for quote.totalUsd.\n3. POST ${docs.invocation.call.url} with Authorization, Idempotency-Key, and JSON body {"quoteId":"...","input":{...}}.\n\n## Input JSON Schema\n\n\`\`\`json\n${JSON.stringify(tool.inputSchema ?? { type: 'object' }, null, 2)}\n\`\`\`\n\n## Output JSON Schema\n\n\`\`\`json\n${JSON.stringify(tool.outputSchema ?? {}, null, 2)}\n\`\`\`\n${direct}`;
}

export function buildRegistryLlmsText(tools: DocumentedTool[], origin: string) {
  const entries = tools.map((tool) => `## ${tool.name}\n\n- Description: ${tool.description ?? 'No description provided.'}\n- Provider: ${tool.provider.name}\n- Price: ${tool.pricing.type === 'free' ? 'Free' : `$${tool.pricing.amount} USD/call`}\n- Usage: ${tool.usage.invocationsLabel}; ${tool.usage.usersLabel}\n- Tool docs: ${origin}/v1/registry/tools/${encodeURIComponent(tool.slug)}/llms.txt\n- OpenAPI: ${origin}/v1/registry/tools/${encodeURIComponent(tool.slug)}/openapi.json`).join('\n\n');

  return `# Markgit Tool Registry\n\n> Searchable, provider-hosted tools with machine-readable schemas, transparent prices, policy-aware quotes, and normalized results.\n\n- JSON catalog: ${origin}/v1/registry/tools?limit=100\n- Registry metadata: ${origin}/v1/registry\n- Authentication: discovery is public; tracked calls require a Bearer API key.\n- Usage coverage: successful calls made through Markgit.\n\n# Tools\n\n${entries || 'No active tools are currently listed.'}\n`;
}
