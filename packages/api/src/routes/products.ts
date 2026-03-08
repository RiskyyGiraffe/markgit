import { Hono } from 'hono';
import {
  getProduct,
  createProduct,
  listProducts,
  listProviderProducts,
  updateProductStatus,
} from '../services/products.js';
import { getProviderByUserId } from '../services/providers.js';
import { ValidationError, ForbiddenError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';
import {
  ensureProductCanPublish,
  ensureProductCanSubmitForReview,
} from '../lib/product-workflow.js';
import { hasBuyerCredential, upsertProviderCredential, upsertUserCredential, deleteUserCredential } from '../services/credentials.js';

const products = new Hono<{ Variables: { auth: AuthContext } }>();

async function requireProvider(userId: string) {
  const provider = await getProviderByUserId(userId);
  if (!provider) {
    throw new ForbiddenError('You must register as a provider first');
  }

  return provider;
}

products.get('/', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const result = await listProducts(limit, offset);
  return c.json(result);
});

products.get('/mine', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const result = await listProviderProducts(provider.id, limit, offset);
  return c.json(result);
});

products.get('/:id', async (c) => {
  const { auth: ctx } = c.var;
  const product = await getProduct(c.req.param('id'));
  const authMode = ((product.executionConfig as { auth?: { mode?: string } } | null)?.auth?.mode ??
    'none') as string;
  const buyerCredentialConfigured =
    authMode === 'buyer_supplied' ? await hasBuyerCredential(ctx.userId, product.id) : false;
  return c.json({
    ...product,
    buyerCredentialConfigured,
  });
});

products.post('/', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    name: string;
    slug: string;
    description?: string;
    category?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    executionConfig?: Record<string, unknown>;
    pricePerCallUsd: string;
    tags?: string[];
  }>();

  if (!body.name || !body.slug || !body.pricePerCallUsd) {
    throw new ValidationError('name, slug, and pricePerCallUsd are required');
  }

  const provider = await requireProvider(ctx.userId);

  const product = await createProduct({
    providerId: provider.id,
    ...body,
  });

  return c.json(product, 201);
});

products.post('/:id/submit', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const product = await getProduct(c.req.param('id'));

  if (product.providerId !== provider.id) {
    throw new ForbiddenError('You do not own this product');
  }

  ensureProductCanSubmitForReview(product.status);
  const updated = await updateProductStatus(product.id, 'pending_review');
  return c.json(updated);
});

products.post('/:id/publish', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const product = await getProduct(c.req.param('id'));

  if (product.providerId !== provider.id) {
    throw new ForbiddenError('You do not own this product');
  }

  ensureProductCanPublish(product.status);
  const updated = await updateProductStatus(product.id, 'active');
  return c.json(updated);
});

products.post('/:id/credentials/provider', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    authType: 'bearer' | 'api_key' | 'basic';
    location: 'header' | 'query' | 'body';
    name: string;
    value: string;
  }>();

  if (!body.authType || !body.location || !body.name || !body.value) {
    throw new ValidationError('authType, location, name, and value are required');
  }

  const credential = await upsertProviderCredential(ctx.userId, c.req.param('id'), body);
  return c.json({ id: credential.id }, 201);
});

products.put('/:id/credentials/provider', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    authType: 'bearer' | 'api_key' | 'basic';
    location: 'header' | 'query' | 'body';
    name: string;
    value: string;
  }>();

  if (!body.authType || !body.location || !body.name || !body.value) {
    throw new ValidationError('authType, location, name, and value are required');
  }

  const credential = await upsertProviderCredential(ctx.userId, c.req.param('id'), body);
  return c.json({ id: credential.id });
});

products.put('/:id/credentials/self', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    authType: 'bearer' | 'api_key' | 'basic';
    location: 'header' | 'query' | 'body';
    name: string;
    value: string;
  }>();

  if (!body.authType || !body.location || !body.name || !body.value) {
    throw new ValidationError('authType, location, name, and value are required');
  }

  const credential = await upsertUserCredential(ctx.userId, c.req.param('id'), body);
  return c.json({ id: credential.id });
});

products.delete('/:id/credentials/self', async (c) => {
  const { auth: ctx } = c.var;
  await deleteUserCredential(ctx.userId, c.req.param('id'));
  return c.body(null, 204);
});

export { products as productRoutes };
