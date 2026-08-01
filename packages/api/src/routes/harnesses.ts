import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { toolCallRequests } from '../db/schema.js';
import { ConflictError, ValidationError } from '../lib/errors.js';
import {
  harnessExecutionConfig,
  manifestHarnessCapabilities,
  manifestHarnessConfig,
  validateHarnessManifest,
} from '../lib/harness-manifest.js';
import type { AuthContext } from '../middleware/auth.js';
import { getPublicHarness } from '../services/harness-registry.js';
import { approveHarnessRun, startHarnessRun } from '../services/harness-runs.js';
import { createProduct, getProductBySlug } from '../services/products.js';
import { getProviderByUserId } from '../services/providers.js';
import { enforceRateLimits } from '../services/spend-controls.js';

const harnesses = new Hono<{ Variables: { auth: AuthContext } }>();

harnesses.post('/', async (c) => {
  const { auth } = c.var;
  const provider = await getProviderByUserId(auth.userId);
  if (!provider) throw new ValidationError('Register as a provider before publishing a harness');
  const manifest = validateHarnessManifest(await c.req.json<unknown>());
  const existing = await getProductBySlug(manifest.slug);
  if (existing) {
    if (existing.kind !== 'harness') throw new ConflictError(`The slug "${manifest.slug}" belongs to a tool`);
    if (existing.providerId !== provider.id) throw new ConflictError(`The harness slug "${manifest.slug}" is already in use`);
    return c.json({
      harness: existing,
      created: false,
      next: existing.status === 'active' ? 'This harness is already active' : `Continue onboarding from its current ${existing.status} status`,
    });
  }
  const harness = await createProduct({
    providerId: provider.id,
    kind: 'harness',
    name: manifest.name,
    slug: manifest.slug,
    logoUrl: manifest.logoUrl,
    description: manifest.description,
    category: manifest.category,
    tags: manifest.tags,
    inputSchema: manifest.inputSchema,
    outputSchema: manifest.outputSchema,
    capabilities: manifestHarnessCapabilities(manifest),
    executionConfig: harnessExecutionConfig(manifest),
    harnessConfig: manifestHarnessConfig(manifest) as unknown as Record<string, unknown>,
    pricePerCallUsd: '0.0000',
  });
  return c.json({
    harness,
    created: true,
    next: `Submit it for review with POST /v1/products/${harness.id}/submit`,
    transparency: {
      access: manifest.access,
      pricing: manifest.pricing,
      compaction: manifest.compaction,
    },
  }, 201);
});

harnesses.post('/:identifier/runs', async (c) => {
  const { auth } = c.var;
  const idempotencyKey = c.req.header('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 255) throw new ValidationError('A valid Idempotency-Key header is required');
  const existing = await db.select().from(toolCallRequests).where(and(
    eq(toolCallRequests.userId, auth.userId),
    eq(toolCallRequests.idempotencyKey, idempotencyKey),
  )).limit(1);
  if (existing[0]?.status === 'completed' && existing[0].response) return c.json(existing[0].response);
  if (existing[0]) throw new ConflictError(`This idempotency key is already ${existing[0].status}`);

  const harness = await getPublicHarness(c.req.param('identifier'));
  const body = await c.req.json<{
    input?: Record<string, unknown>;
    approval?: { manifestDigest?: string };
  }>().catch(() => ({}) as {
    input?: Record<string, unknown>;
    approval?: { manifestDigest?: string };
  });
  if (body.input !== undefined && (!body.input || typeof body.input !== 'object' || Array.isArray(body.input))) {
    throw new ValidationError('input must be a JSON object');
  }
  const input = body.input ?? {};
  const requiredFields = Array.isArray(harness.inputSchema?.required)
    ? harness.inputSchema.required.filter((field): field is string => typeof field === 'string')
    : [];
  const missingFields = requiredFields.filter((field) => !(field in input));
  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required input fields: ${missingFields.join(', ')}`);
  }
  const [request] = await db.insert(toolCallRequests).values({
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
    productId: harness.id,
    idempotencyKey,
  }).onConflictDoNothing().returning();
  if (!request) throw new ConflictError('This idempotency key is already processing');
  try {
    await enforceRateLimits(auth.userId, harness.id);
    await approveHarnessRun(auth.userId, harness, body.approval?.manifestDigest);
    const response = await startHarnessRun(auth.userId, auth.apiKeyId, {
      id: harness.id,
      slug: harness.slug,
      name: harness.name,
    }, {
      input,
    });
    await db.update(toolCallRequests).set({ status: 'completed', response, updatedAt: new Date() })
      .where(eq(toolCallRequests.id, request.id));
    c.header('Location', `/v1/harness-runs/${response.id}`);
    return c.json(response, 201);
  } catch (error) {
    await db.update(toolCallRequests).set({ status: 'failed', updatedAt: new Date() })
      .where(eq(toolCallRequests.id, request.id));
    throw error;
  }
});

export { harnesses as harnessRoutes };
