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
  const product = await getProduct(c.req.param('id'));
  return c.json(product);
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

export { products as productRoutes };
