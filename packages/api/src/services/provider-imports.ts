import { and, desc, eq } from 'drizzle-orm';
import YAML from 'yaml';
import { db } from '../db/index.js';
import { products, providerImportRuns, providers } from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js';
import {
  normalizeDraft,
  slugifyName,
  type AuthMode,
  type ExecutionAuthConfig,
  type ImportSourceType,
  type ProductDraft,
  type TestCredentialPayload,
} from '../lib/provider-import.js';
import { runAdhocExecution } from './execution-engine.js';
import { upsertProviderCredential } from './credentials.js';

type ImportRunRecord = typeof providerImportRuns.$inferSelect;

type OpenApiParameter = {
  name?: string;
  in?: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  schema?: { type?: string };
  description?: string;
};

type ProviderImportDraftInput = {
  docsUrl: string;
  baseUrl: string;
  authMode: AuthMode;
};

type ReviewDraftInput = Partial<ProductDraft>;

type PublishInput = {
  draft?: Partial<ProductDraft>;
  providerCredential?: Omit<TestCredentialPayload, 'scheme'> & { scheme?: string };
};

type NormalizedImportResult = {
  sourceType: ImportSourceType;
  confidence: number;
  warnings: string[];
  errors: string[];
  draft: ProductDraft;
};

type ImportTestResult = {
  success: boolean;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
};

function mergeDrafts(currentDraft: Partial<ProductDraft>, nextDraft: Partial<ProductDraft>): Partial<ProductDraft> {
  const currentExecution = currentDraft.executionConfig;
  const nextExecution = nextDraft.executionConfig;

  return {
    ...currentDraft,
    ...nextDraft,
    executionConfig:
      currentExecution || nextExecution
        ? {
            type: 'http_rest' as const,
            ...(currentExecution ?? {}),
            ...(nextExecution ?? {}),
            auth: {
              ...((currentExecution?.auth ?? {}) as Partial<ExecutionAuthConfig>),
              ...((nextExecution?.auth ?? {}) as Partial<ExecutionAuthConfig>),
            },
          }
        : undefined,
  } as Partial<ProductDraft>;
}

function ensureProviderOwnership(provider: { userId: string } | null, userId: string) {
  if (!provider) throw new NotFoundError('Provider');
  if (provider.userId !== userId) throw new ValidationError('Provider ownership mismatch');
}

async function getProviderForUser(userId: string) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.userId, userId))
    .limit(1);

  if (!provider) throw new NotFoundError('Provider');
  return provider;
}

async function ensureUniqueSlug(baseSlug: string) {
  let candidate = baseSlug;
  let counter = 2;

  while (true) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidate))
      .limit(1);

    if (!existing) return candidate;
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

function cleanText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18_000);
}

function extractDocLinks(documentUrl: string, html: string) {
  const matches = [...html.matchAll(/href=["']([^"'#]+)["']/gi)];
  const links = new Set<string>();

  for (const match of matches) {
    const raw = match[1];
    try {
      const resolved = new URL(raw, documentUrl);
      links.add(resolved.toString());
    } catch {
      continue;
    }
  }

  return [...links].filter((link) =>
    /(openapi|swagger|postman|docs|api|json|yaml|yml)/i.test(link),
  );
}

function extractQueryHints(rawBody: string, baseUrl: string) {
  const candidates = new Set<string>();
  const urls = [...rawBody.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map((match) => match[0]);

  for (const rawUrl of urls) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.host !== new URL(baseUrl).host) continue;
      for (const key of parsed.searchParams.keys()) {
        if (key) candidates.add(key);
      }
    } catch {
      continue;
    }
  }

  for (const match of rawBody.matchAll(/[?&]([a-zA-Z_][a-zA-Z0-9_]*)=/g)) {
    candidates.add(match[1]);
  }

  return [...candidates];
}

function applyImportHeuristics(
  draft: ProductDraft,
  rawBody: string,
  docsUrl: string,
  baseUrl: string,
): ProductDraft {
  const paramHints = extractQueryHints(rawBody, baseUrl);
  const currentFields = Object.keys((draft.inputSchema?.properties as Record<string, unknown> | undefined) ?? {});
  const genericFields = currentFields.filter((field) => /^(field|input|param|query)$/i.test(field));

  if (paramHints.length === 1 && genericFields.length === 1) {
    const inferredParam = paramHints[0];
    const currentField = genericFields[0];
    const properties = { ...((draft.inputSchema?.properties as Record<string, unknown>) ?? {}) };
    const currentProperty = properties[currentField];
    delete properties[currentField];
    properties[inferredParam] = currentProperty;

    const required = Array.isArray(draft.inputSchema?.required)
      ? draft.inputSchema.required.map((field) => (field === currentField ? inferredParam : field))
      : [];

    const paramMapping = { ...(draft.executionConfig.paramMapping ?? {}) };
    const currentMapping = paramMapping[currentField] ?? { target: 'query' as const, param: inferredParam };
    delete paramMapping[currentField];
    paramMapping[inferredParam] = { ...currentMapping, param: inferredParam };

    draft = normalizeDraft(
      {
        ...draft,
        inputSchema: {
          ...(draft.inputSchema ?? {}),
          type: 'object',
          required,
          properties,
        },
        executionConfig: {
          ...draft.executionConfig,
          paramMapping,
        },
      },
      baseUrl,
      draft.executionConfig.auth.mode,
    );
  }

  const hostname = new URL(baseUrl).hostname.replace(/^api\./, '').split('.').slice(0, -1).join(' ');
  const extraTags = [hostname, ...paramHints].filter(Boolean);
  draft = {
    ...draft,
    tags: Array.from(new Set([...draft.tags, ...extraTags])).slice(0, 12),
    description:
      draft.description ??
      `Imported from ${new URL(docsUrl).hostname} and prepared for agent search and execution.`,
  };

  return draft;
}

function normalizeMethod(method: string | undefined) {
  if (!method) return 'GET' as const;
  const upper = method.toUpperCase();
  if (upper === 'GET' || upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE') {
    return upper;
  }
  return 'GET' as const;
}

function buildDraftFromOpenApiDocument(
  document: Record<string, any>,
  baseUrl: string,
  authMode: AuthMode,
  sourceType: ImportSourceType,
): NormalizedImportResult {
  const warnings: string[] = [];
  const info = document.info ?? {};
  const servers = Array.isArray(document.servers) ? document.servers : [];
  const serverUrl = typeof servers[0]?.url === 'string' ? servers[0].url : baseUrl;
  const paths = document.paths ?? {};
  const pathEntries = Object.entries(paths);

  if (pathEntries.length === 0) {
    throw new ValidationError('No paths found in imported API spec');
  }

  const [rawPath, operations] = pathEntries[0] as [string, Record<string, any>];
  const [rawMethod, operation] = Object.entries(operations)[0] as [string, Record<string, any>];
  const method = normalizeMethod(rawMethod);
  const parameters = [
    ...(Array.isArray(document.parameters) ? document.parameters : []),
    ...(Array.isArray(operation?.parameters) ? operation.parameters : []),
  ] as OpenApiParameter[];

  const inputRequired: string[] = [];
  const inputProperties: Record<string, unknown> = {};
  const paramMapping: Record<string, { target: 'query' | 'header' | 'body'; param: string }> = {};

  for (const parameter of parameters) {
    if (!parameter?.name || !parameter.in) continue;
    if (parameter.in === 'path') {
      warnings.push(`Path parameter ${parameter.name} was ignored in the initial draft`);
      continue;
    }

    const propertyName = parameter.name;
    inputProperties[propertyName] = {
      type: parameter.schema?.type ?? 'string',
      description: parameter.description,
    };
    if (parameter.required) inputRequired.push(propertyName);

    if (parameter.in === 'query' || parameter.in === 'header') {
      paramMapping[propertyName] = {
        target: parameter.in,
        param: parameter.name,
      };
    }
  }

  const requestSchema =
    operation?.requestBody?.content?.['application/json']?.schema ??
    operation?.requestBody?.content?.['application/x-www-form-urlencoded']?.schema;
  const requestProperties = requestSchema?.properties ?? {};
  const requestRequired = Array.isArray(requestSchema?.required) ? requestSchema.required : [];

  for (const [name, schema] of Object.entries(requestProperties)) {
    if (inputProperties[name]) continue;
    const typedSchema = schema as { type?: string; description?: string };
    inputProperties[name] = {
      type: typedSchema.type ?? 'string',
      description: typedSchema.description,
    };
    if (requestRequired.includes(name)) inputRequired.push(name);
    paramMapping[name] = { target: 'body', param: name };
  }

  const base = new URL(serverUrl, baseUrl);
  const requestUrl = new URL(rawPath, base);

  const draft = normalizeDraft(
    {
      name: info.title ?? operation?.summary ?? 'Imported API',
      slug: slugifyName(info.title ?? operation?.summary ?? 'imported-api'),
      description: operation?.description ?? info.description ?? `Imported from ${sourceType}`,
      category: 'API',
      pricePerCallUsd: '0.2500',
      tags: ['imported', 'api'],
      inputSchema: {
        type: 'object',
        required: Array.from(new Set(inputRequired)),
        properties: inputProperties,
      },
      outputSchema: operation?.responses?.['200']?.content?.['application/json']?.schema,
      executionConfig: {
        type: 'http_rest',
        method,
        baseUrl: requestUrl.toString(),
        timeoutMs: 10000,
        paramMapping,
        auth: inferAuthConfigFromSpec(document, operation, authMode),
      },
    },
    requestUrl.toString(),
    authMode,
  );

  return {
    sourceType,
    confidence: 0.92,
    warnings,
    errors: [],
    draft,
  };
}

function inferAuthConfigFromSpec(document: Record<string, any>, operation: Record<string, any>, authMode: AuthMode) {
  if (authMode === 'none') {
    return { mode: 'none', type: 'none', location: 'header', name: 'Authorization' } as const;
  }

  const securitySchemes = document.components?.securitySchemes ?? {};
  const security = (Array.isArray(operation?.security) && operation.security[0]) ||
    (Array.isArray(document.security) && document.security[0]);
  const schemeName = security ? Object.keys(security)[0] : Object.keys(securitySchemes)[0];
  const scheme = schemeName ? securitySchemes[schemeName] : null;

  if (scheme?.type === 'http' && scheme?.scheme === 'bearer') {
    return {
      mode: authMode,
      type: 'bearer',
      location: 'header',
      name: 'Authorization',
      scheme: 'Bearer',
    } as const;
  }

  if (scheme?.type === 'apiKey') {
    return {
      mode: authMode,
      type: 'api_key',
      location: scheme.in === 'query' ? 'query' : scheme.in === 'header' ? 'header' : 'header',
      name: scheme.name ?? 'x-api-key',
    } as const;
  }

  if (scheme?.type === 'http' && scheme?.scheme === 'basic') {
    return {
      mode: authMode,
      type: 'basic',
      location: 'header',
      name: 'Authorization',
      scheme: 'Basic',
    } as const;
  }

  return {
    mode: authMode,
    type: 'api_key',
    location: 'header',
    name: 'Authorization',
  } as const;
}

function buildDraftFromPostmanCollection(
  collection: Record<string, any>,
  baseUrl: string,
  authMode: AuthMode,
): NormalizedImportResult {
  const item = Array.isArray(collection.item) ? collection.item[0] : null;
  const request = item?.request;
  if (!request?.url) {
    throw new ValidationError('Could not find a request definition in the Postman collection');
  }

  const method = normalizeMethod(request.method);
  const rawUrl =
    typeof request.url === 'string'
      ? request.url
      : request.url.raw ?? new URL(baseUrl).toString();

  const queryParams = Array.isArray(request.url?.query) ? request.url.query : [];
  const inputProperties: Record<string, unknown> = {};
  const required: string[] = [];
  const paramMapping: Record<string, { target: 'query' | 'header' | 'body'; param: string }> = {};

  for (const query of queryParams) {
    if (!query?.key) continue;
    inputProperties[query.key] = { type: 'string', description: query.description };
    paramMapping[query.key] = { target: 'query', param: query.key };
  }

  const draft = normalizeDraft(
    {
      name: collection.info?.name ?? item?.name ?? 'Imported Postman API',
      slug: slugifyName(collection.info?.name ?? item?.name ?? 'imported-postman-api'),
      description: collection.info?.description ?? item?.name ?? 'Imported from Postman collection',
      category: 'API',
      pricePerCallUsd: '0.2500',
      tags: ['imported', 'postman'],
      inputSchema: {
        type: 'object',
        required,
        properties: inputProperties,
      },
      executionConfig: {
        type: 'http_rest',
        method,
        baseUrl: rawUrl,
        timeoutMs: 10000,
        paramMapping,
        auth: {
          mode: authMode,
          type: authMode === 'none' ? 'none' : 'api_key',
          location: 'header',
          name: 'Authorization',
        },
      },
    },
    rawUrl,
    authMode,
  );

  return {
    sourceType: 'postman_collection',
    confidence: 0.85,
    warnings: [],
    errors: [],
    draft,
  };
}

async function buildDraftWithOpenRouter(
  docsBody: string,
  baseUrl: string,
  authMode: AuthMode,
): Promise<NormalizedImportResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new ValidationError('OPENROUTER_API_KEY is not configured');
  }

  const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';
  const prompt = [
    'You extract an API product draft from documentation.',
    'Return JSON only with this shape:',
    JSON.stringify(
      {
        name: 'string',
        slug: 'string',
        description: 'string',
        category: 'string',
        pricePerCallUsd: '0.2500',
        tags: ['imported', 'api'],
        confidence: 0.0,
        warnings: ['string'],
        inputSchema: {
          type: 'object',
          required: ['field'],
          properties: {
            field: { type: 'string', description: 'field description' },
          },
        },
        outputSchema: {},
        executionConfig: {
          type: 'http_rest',
          method: 'GET',
          baseUrl,
          timeoutMs: 10000,
          paramMapping: {
            field: { target: 'query', param: 'field' },
          },
          auth: {
            mode: authMode,
            type: authMode === 'none' ? 'none' : 'api_key',
            location: 'header',
            name: 'Authorization',
            scheme: authMode === 'none' ? undefined : 'Bearer',
          },
        },
      },
      null,
      2,
    ),
    'Use the provided baseUrl if docs are ambiguous.',
    `Base URL: ${baseUrl}`,
    `Auth mode: ${authMode}`,
    `Docs:\n${docsBody}`,
  ].join('\n\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ValidationError(`OpenRouter import failed: ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new ValidationError('OpenRouter did not return a draft');
  }

  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ValidationError('OpenRouter returned invalid JSON');
  }

  const draft = normalizeDraft(parsed as Partial<ProductDraft>, baseUrl, authMode);

  return {
    sourceType: 'html_docs',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.65,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((x) => typeof x === 'string') : [],
    errors: [],
    draft,
  };
}

export async function importDocs(input: ProviderImportDraftInput): Promise<NormalizedImportResult> {
  const response = await fetch(input.docsUrl, {
    headers: { Accept: 'application/json, text/yaml, text/plain, text/html' },
  });

  if (!response.ok) {
    throw new ValidationError(`Failed to fetch docs URL: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  const trimmed = body.trim();
  const candidateLinks = contentType.includes('html') ? extractDocLinks(input.docsUrl, body).slice(0, 5) : [];

  if (contentType.includes('application/json') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    if (parsed?.openapi || parsed?.swagger) {
      return buildDraftFromOpenApiDocument(parsed, input.baseUrl, input.authMode, 'openapi_json');
    }
    if (parsed?.info && parsed?.item) {
      return buildDraftFromPostmanCollection(parsed, input.baseUrl, input.authMode);
    }
  }

  if (
    contentType.includes('yaml') ||
    contentType.includes('yml') ||
    /^openapi:\s|^swagger:\s/m.test(trimmed)
  ) {
    const parsed = YAML.parse(trimmed) as Record<string, any>;
    if (parsed?.openapi || parsed?.swagger) {
      return buildDraftFromOpenApiDocument(parsed, input.baseUrl, input.authMode, 'openapi_yaml');
    }
  }

  for (const candidateLink of candidateLinks) {
    try {
      const linked = await fetch(candidateLink, {
        headers: { Accept: 'application/json, text/yaml, text/plain, text/html' },
      });
      if (!linked.ok) continue;
      const linkedContentType = linked.headers.get('content-type') ?? '';
      const linkedBody = await linked.text();
      const linkedTrimmed = linkedBody.trim();

      if (linkedContentType.includes('application/json') || linkedTrimmed.startsWith('{')) {
        const parsed = JSON.parse(linkedTrimmed);
        if (parsed?.openapi || parsed?.swagger) {
          return buildDraftFromOpenApiDocument(parsed, input.baseUrl, input.authMode, 'openapi_json');
        }
        if (parsed?.info && parsed?.item) {
          return buildDraftFromPostmanCollection(parsed, input.baseUrl, input.authMode);
        }
      }

      if (
        linkedContentType.includes('yaml') ||
        linkedContentType.includes('yml') ||
        /^openapi:\s|^swagger:\s/m.test(linkedTrimmed)
      ) {
        const parsed = YAML.parse(linkedTrimmed) as Record<string, any>;
        if (parsed?.openapi || parsed?.swagger) {
          return buildDraftFromOpenApiDocument(parsed, input.baseUrl, input.authMode, 'openapi_yaml');
        }
      }
    } catch {
      continue;
    }
  }

  const imported = await buildDraftWithOpenRouter(cleanText(body), input.baseUrl, input.authMode);
  return {
    ...imported,
    draft: applyImportHeuristics(imported.draft, body, input.docsUrl, input.baseUrl),
  };
}

async function getImportRunForProvider(userId: string, importRunId: string) {
  const provider = await getProviderForUser(userId);
  const [run] = await db
    .select()
    .from(providerImportRuns)
    .where(
      and(
        eq(providerImportRuns.id, importRunId),
        eq(providerImportRuns.providerId, provider.id),
      ),
    )
    .limit(1);

  if (!run) throw new NotFoundError('Provider import run');
  return { provider, run };
}

export async function listProviderImportRuns(userId: string) {
  const provider = await getProviderForUser(userId);
  const results = await db
    .select()
    .from(providerImportRuns)
    .where(eq(providerImportRuns.providerId, provider.id))
    .orderBy(desc(providerImportRuns.createdAt));
  return { results, total: results.length };
}

export async function getProviderImportRun(userId: string, importRunId: string) {
  const { run } = await getImportRunForProvider(userId, importRunId);
  return run;
}

export async function createProviderImportRun(userId: string, input: ProviderImportDraftInput) {
  const provider = await getProviderForUser(userId);

  const [run] = await db
    .insert(providerImportRuns)
    .values({
      providerId: provider.id,
      docsUrl: input.docsUrl,
      baseUrl: input.baseUrl,
      status: 'fetching',
    })
    .returning();

  try {
    const imported = await importDocs(input);
    const [updated] = await db
      .update(providerImportRuns)
      .set({
        sourceType: imported.sourceType,
        status: 'review_ready',
        confidence: imported.confidence.toFixed(4),
        warnings: imported.warnings,
        errors: imported.errors,
        generatedDraft: imported.draft as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(providerImportRuns.id, run.id))
      .returning();

    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    const [updated] = await db
      .update(providerImportRuns)
      .set({
        status: 'created',
        errors: [message],
        updatedAt: new Date(),
      })
      .where(eq(providerImportRuns.id, run.id))
      .returning();
    throw new ValidationError(updated.errors[0] ?? 'Import failed');
  }
}

export async function reviewProviderImportRun(
  userId: string,
  importRunId: string,
  draftInput: ReviewDraftInput,
) {
  const { run } = await getImportRunForProvider(userId, importRunId);
  const currentDraft = (run.generatedDraft ?? {}) as Partial<ProductDraft>;
  const mergedDraft = normalizeDraft(
    mergeDrafts(currentDraft, draftInput),
    run.baseUrl,
    (((draftInput.executionConfig as any)?.auth?.mode ??
      (currentDraft.executionConfig as any)?.auth?.mode ??
      'none') as AuthMode),
  );

  const [updated] = await db
    .update(providerImportRuns)
    .set({
      generatedDraft: mergedDraft as unknown as Record<string, unknown>,
      status: 'test_ready',
      updatedAt: new Date(),
    })
    .where(eq(providerImportRuns.id, run.id))
    .returning();

  return updated;
}

export async function testProviderImportRun(
  userId: string,
  importRunId: string,
  input: Record<string, unknown>,
  credential?: TestCredentialPayload,
): Promise<{ run: ImportRunRecord; result: ImportTestResult }> {
  const { run } = await getImportRunForProvider(userId, importRunId);
  const draft = run.generatedDraft as ProductDraft | null;
  if (!draft) {
    throw new ValidationError('Import run has no generated draft to test');
  }

  const authMode = draft.executionConfig.auth.mode;
  if (authMode !== 'none' && !credential) {
    throw new ValidationError('A test credential is required for authenticated products');
  }

  const result = await runAdhocExecution(draft.executionConfig, input, credential);

  const [updated] = await db
    .update(providerImportRuns)
    .set({
      status: result.success ? 'test_passed' : 'test_failed',
      lastTestRequest: input,
      lastTestResponse: result.success
        ? { success: true, output: result.output }
        : { success: false, error: result.errorMessage },
      updatedAt: new Date(),
    })
    .where(eq(providerImportRuns.id, run.id))
    .returning();

  return {
    run: updated,
    result,
  };
}

export async function publishProviderImportRun(userId: string, importRunId: string, input: PublishInput) {
  const { provider, run } = await getImportRunForProvider(userId, importRunId);
  if (run.status === 'published') {
    throw new ConflictError('This import run has already been published');
  }

  const draft = normalizeDraft(
    mergeDrafts((run.generatedDraft ?? {}) as Partial<ProductDraft>, input.draft ?? {}),
    run.baseUrl,
    (((input.draft?.executionConfig as any)?.auth?.mode ??
      (run.generatedDraft as any)?.executionConfig?.auth?.mode ??
      'none') as AuthMode),
  );

  const slug = await ensureUniqueSlug(draft.slug);

  const [product] = await db
    .insert(products)
    .values({
      providerId: provider.id,
      name: draft.name,
      slug,
      description: draft.description,
      category: draft.category,
      status: 'active',
      inputSchema: draft.inputSchema,
      outputSchema: draft.outputSchema,
      executionConfig: draft.executionConfig,
      pricePerCallUsd: draft.pricePerCallUsd,
      tags: draft.tags,
    })
    .returning();

  if (draft.executionConfig.auth.mode === 'provider_managed') {
    if (!input.providerCredential) {
      throw new ValidationError('A provider credential is required before publishing this product');
    }

    await upsertProviderCredential(userId, product.id, {
      authType: input.providerCredential.authType,
      location: input.providerCredential.location,
      name: input.providerCredential.name,
      value: input.providerCredential.value,
    });
  }

  const [updated] = await db
    .update(providerImportRuns)
    .set({
      generatedDraft: { ...draft, slug, publishedProductId: product.id } as unknown as Record<string, unknown>,
      status: 'published',
      updatedAt: new Date(),
    })
    .where(eq(providerImportRuns.id, run.id))
    .returning();

  return {
    run: updated,
    product,
  };
}
