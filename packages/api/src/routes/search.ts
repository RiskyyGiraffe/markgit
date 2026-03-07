import { Hono } from 'hono';
import { searchProducts } from '../services/search.js';
import { ValidationError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';

const search = new Hono<{ Variables: { auth: AuthContext } }>();

search.post('/', async (c) => {
  const body = await c.req.json<{ query: string; limit?: number; offset?: number }>();

  if (!body.query?.trim()) {
    throw new ValidationError('query is required');
  }

  const results = await searchProducts(body.query, body.limit, body.offset);
  return c.json(results);
});

export { search as searchRoutes };
