import { Hono } from 'hono';
import {
  createProviderImportRun,
  getProviderImportRun,
  listProviderImportRuns,
  publishProviderImportRun,
  reviewProviderImportRun,
  testProviderImportRun,
} from '../services/provider-imports.js';
import { ValidationError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';

const providerImports = new Hono<{ Variables: { auth: AuthContext } }>();

providerImports.get('/', async (c) => {
  const { auth: ctx } = c.var;
  const result = await listProviderImportRuns(ctx.userId);
  return c.json(result);
});

providerImports.post('/', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    docsUrl: string;
    baseUrl: string;
    authMode: 'none' | 'provider_managed' | 'buyer_supplied';
  }>();

  if (!body.docsUrl || !body.baseUrl || !body.authMode) {
    throw new ValidationError('docsUrl, baseUrl, and authMode are required');
  }

  const run = await createProviderImportRun(ctx.userId, body);
  return c.json(run, 201);
});

providerImports.get('/:id', async (c) => {
  const { auth: ctx } = c.var;
  const run = await getProviderImportRun(ctx.userId, c.req.param('id'));
  return c.json(run);
});

providerImports.post('/:id/review', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<Record<string, unknown>>();
  const run = await reviewProviderImportRun(
    ctx.userId,
    c.req.param('id'),
    body as any,
  );
  return c.json(run);
});

providerImports.post('/:id/test', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    input?: Record<string, unknown>;
    credential?: {
      value: string;
      authType: 'bearer' | 'api_key' | 'basic';
      location: 'header' | 'query' | 'body';
      name: string;
      scheme?: string;
    };
  }>();

  const result = await testProviderImportRun(
    ctx.userId,
    c.req.param('id'),
    body.input ?? {},
    body.credential,
  );
  return c.json(result);
});

providerImports.post('/:id/publish', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    draft?: Record<string, unknown>;
    providerCredential?: {
      value: string;
      authType: 'bearer' | 'api_key' | 'basic';
      location: 'header' | 'query' | 'body';
      name: string;
      scheme?: string;
    };
  }>();

  const result = await publishProviderImportRun(ctx.userId, c.req.param('id'), body as any);
  return c.json(result, 201);
});

export { providerImports as providerImportRoutes };
