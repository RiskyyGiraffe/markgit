import { Hono } from 'hono';
import { getProduct, createProduct, listProducts } from '../services/products.js';
import { getProviderByUserId } from '../services/providers.js';
import { ValidationError, ForbiddenError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';

const products = new Hono<{ Variables: { auth: AuthContext } }>();

products.get('/', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const result = await listProducts(limit, offset);
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

  const provider = await getProviderByUserId(ctx.userId);
  if (!provider) {
    throw new ForbiddenError('You must register as a provider first');
  }

  const product = await createProduct({
    providerId: provider.id,
    ...body,
  });

  return c.json(product, 201);
});

export { products as productRoutes };
