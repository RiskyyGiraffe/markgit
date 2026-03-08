import { Hono } from 'hono';
import { getProviderByUserId } from '../services/providers.js';
import {
  createConnectAccount,
  createAccountLink,
  createDashboardLink,
  getStripeStatus,
  getEarningsSummary,
  listEarnings,
  listPayouts,
  syncStripeStatus,
} from '../services/stripe-connect.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';

const providerStripe = new Hono<{ Variables: { auth: AuthContext } }>();

async function requireProvider(userId: string) {
  const provider = await getProviderByUserId(userId);
  if (!provider) throw new NotFoundError('Provider — register as a provider first');
  return provider;
}

// POST /v1/providers/stripe/connect — start Stripe onboarding
providerStripe.post('/stripe/connect', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const body = await c.req.json<{ refreshUrl: string; returnUrl: string }>();

  if (!body.refreshUrl || !body.returnUrl) {
    throw new ValidationError('refreshUrl and returnUrl are required');
  }

  // Create account if needed
  await createConnectAccount(provider.id);

  // Generate onboarding link
  const { url } = await createAccountLink(provider.id, body.refreshUrl, body.returnUrl);
  return c.json({ url });
});

// GET /v1/providers/stripe/status — check account status
providerStripe.get('/stripe/status', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const status = await getStripeStatus(provider.id);
  return c.json(status);
});

providerStripe.post('/stripe/sync', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const status = await syncStripeStatus(provider.id);
  return c.json(status);
});

// GET /v1/providers/stripe/dashboard — Express dashboard login link
providerStripe.get('/stripe/dashboard', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const { url } = await createDashboardLink(provider.id);
  return c.json({ url });
});

// GET /v1/providers/earnings — earnings summary
providerStripe.get('/earnings', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const summary = await getEarningsSummary(provider.id);
  return c.json(summary);
});

// GET /v1/providers/earnings/calls — per-call earnings log
providerStripe.get('/earnings/calls', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const result = await listEarnings(provider.id, limit, offset);
  return c.json(result);
});

// GET /v1/providers/payouts — list payout history
providerStripe.get('/payouts', async (c) => {
  const { auth: ctx } = c.var;
  const provider = await requireProvider(ctx.userId);
  const result = await listPayouts(provider.id);
  return c.json(result);
});

export { providerStripe as providerStripeRoutes };
