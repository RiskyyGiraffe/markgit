import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { toolCallRequests } from '../db/schema.js';
import { ConflictError, ValidationError } from '../lib/errors.js';
import { manifestExecutionConfig, validateToolManifest } from '../lib/tool-manifest.js';
import type { AuthContext } from '../middleware/auth.js';
import { createProduct, getProductBySlug } from '../services/products.js';
import { getProviderByUserId } from '../services/providers.js';
import { createPurchase, createQuote } from '../services/purchases.js';
import { getPublicTool } from '../services/registry.js';
import { getOrCreateWallet } from '../services/wallet.js';
import { enforceRateLimits, getSpendControlPreview } from '../services/spend-controls.js';

const tools = new Hono<{ Variables: { auth: AuthContext } }>();

tools.post('/', async (c) => {
  const { auth } = c.var;
  const provider = await getProviderByUserId(auth.userId);
  if (!provider) {
    throw new ValidationError('Register as a provider before publishing a tool');
  }

  const manifest = validateToolManifest(await c.req.json<unknown>());
  const existing = await getProductBySlug(manifest.slug);
  if (existing) {
    if (existing.kind !== 'tool') {
      throw new ConflictError(`The slug "${manifest.slug}" belongs to another listing type`);
    }
    if (existing.providerId !== provider.id) {
      throw new ConflictError(`The tool slug "${manifest.slug}" is already in use`);
    }
    return c.json({
      tool: existing,
      created: false,
      next: existing.status === 'active'
        ? 'This tool is already active'
        : `Continue onboarding from its current ${existing.status} status`,
    });
  }

  const product = await createProduct({
    providerId: provider.id,
    name: manifest.name,
    kind: 'tool',
    slug: manifest.slug,
    logoUrl: manifest.logoUrl,
    description: manifest.description,
    category: manifest.category,
    tags: manifest.tags,
    inputSchema: manifest.inputSchema,
    outputSchema: manifest.outputSchema,
    capabilities: manifest.capabilities,
    executionConfig: manifestExecutionConfig(manifest),
    pricePerCallUsd: manifest.pricing.amountPerCallUsd,
  });

  return c.json({
    tool: product,
    created: true,
    next: `Submit it for review with POST /v1/products/${product.id}/submit`,
  }, 201);
});

tools.post('/:identifier/quote', async (c) => {
  const { auth } = c.var;
  const tool = await getPublicTool(c.req.param('identifier'));
  const wallet = await getOrCreateWallet(auth.userId);
  const quote = await createQuote(auth.userId, tool.id, wallet.id);
  const controls = await getSpendControlPreview(auth.userId, tool.id, quote.totalUsd);

  return c.json({
    quote: {
      id: quote.id,
      priceUsd: quote.priceUsd,
      feeUsd: quote.markgitFeeUsd,
      totalUsd: quote.totalUsd,
      expiresAt: quote.expiresAt,
      manifestDigest: quote.manifestDigest,
    },
    tool: { id: tool.id, slug: tool.slug, name: tool.name },
    policy: quote.policySnapshot,
    controls,
  }, 201);
});

tools.post('/:identifier/call', async (c) => {
  const { auth } = c.var;
  const idempotencyKey = c.req.header('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 255) {
    throw new ValidationError('A valid Idempotency-Key header is required');
  }

  const existing = await db
    .select()
    .from(toolCallRequests)
    .where(and(
      eq(toolCallRequests.userId, auth.userId),
      eq(toolCallRequests.idempotencyKey, idempotencyKey),
    ))
    .limit(1);

  if (existing[0]?.status === 'completed' && existing[0].response) {
    return c.json(existing[0].response);
  }
  if (existing[0]) {
    throw new ConflictError(`This idempotency key is already ${existing[0].status}`);
  }

  const tool = await getPublicTool(c.req.param('identifier'));
  const body: {
    input?: Record<string, unknown>;
    quoteId?: string;
    approval?: { manifestDigest?: string };
  } = await c.req
    .json<{
      input?: Record<string, unknown>;
      quoteId?: string;
      approval?: { manifestDigest?: string };
    }>()
    .catch(() => ({}));
  if (!body.quoteId) {
    throw new ValidationError('quoteId is required; request and approve a quote before calling a paid tool');
  }
  const [request] = await db
    .insert(toolCallRequests)
    .values({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      productId: tool.id,
      idempotencyKey,
    })
    .onConflictDoNothing()
    .returning();

  if (!request) {
    const [racedRequest] = await db
      .select()
      .from(toolCallRequests)
      .where(and(
        eq(toolCallRequests.userId, auth.userId),
        eq(toolCallRequests.idempotencyKey, idempotencyKey),
      ))
      .limit(1);
    if (racedRequest?.status === 'completed' && racedRequest.response) {
      return c.json(racedRequest.response);
    }
    throw new ConflictError('This idempotency key is already processing');
  }

  try {
    await enforceRateLimits(auth.userId, tool.id);
    const result = await createPurchase(auth.userId, {
      productId: tool.id,
      quoteId: body.quoteId,
      input: body.input ?? {},
      apiKeyId: auth.apiKeyId,
      approvalManifestDigest: body.approval?.manifestDigest,
    });

    const quote = await db.query.quotes.findFirst({
      where: (quotes, { eq }) => eq(quotes.id, body.quoteId!),
    });
    if (!quote) throw new ValidationError('Approved quote was not found');

    const response = {
      id: result.executionId,
      tool: { id: tool.id, slug: tool.slug, name: tool.name },
      status: result.execution.status,
      cost: {
        priceUsd: quote.priceUsd,
        feeUsd: quote.markgitFeeUsd,
        totalUsd: quote.totalUsd,
        currency: 'USD',
      },
      output: result.execution.output,
      error: result.execution.errorMessage
        ? { message: result.execution.errorMessage }
        : null,
    };

    await db
      .update(toolCallRequests)
      .set({ status: 'completed', response, updatedAt: new Date() })
      .where(eq(toolCallRequests.id, request.id));

    c.header('X-Markgit-Call-Id', result.executionId);
    return c.json(response);
  } catch (error) {
    await db
      .update(toolCallRequests)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(toolCallRequests.id, request.id));
    throw error;
  }
});

export { tools as toolRoutes };
