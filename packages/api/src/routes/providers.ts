import { Hono } from 'hono';
import { getProviderByUserId, registerProvider } from '../services/providers.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';

const providers = new Hono<{ Variables: { auth: AuthContext } }>();

providers.get('/', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await getProviderByUserId(ctx.userId);

  if (!provider) {
    throw new NotFoundError('Provider');
  }

  return c.json(provider);
});

providers.post('/', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    name: string;
    description?: string;
    websiteUrl?: string;
  }>();

  if (!body.name) {
    throw new ValidationError('name is required');
  }

  const provider = await registerProvider(ctx.userId, body);
  return c.json(provider, 201);
});

export { providers as providerRoutes };
