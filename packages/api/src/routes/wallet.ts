import { Hono } from 'hono';
import { getOrCreateWallet, getWalletBalance, fundWallet, getLedgerEntries } from '../services/wallet.js';
import { createCheckoutSession } from '../services/stripe-checkout.js';
import { ForbiddenError, ValidationError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';

const wallet = new Hono<{ Variables: { auth: AuthContext } }>();

wallet.get('/', async (c) => {
  const { auth: ctx } = c.var;
  const w = await getOrCreateWallet(ctx.userId);
  const balance = await getWalletBalance(w.id);
  return c.json(balance);
});

wallet.get('/ledger', async (c) => {
  const { auth: ctx } = c.var;
  const w = await getOrCreateWallet(ctx.userId);
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const result = await getLedgerEntries(w.id, limit, offset);
  return c.json(result);
});

wallet.post('/fund', async (c) => {
  if (process.env.ALLOW_DIRECT_WALLET_FUNDING !== 'true') {
    throw new ForbiddenError('Direct wallet funding is disabled; use Stripe Checkout');
  }

  const { auth: ctx } = c.var;
  const body = await c.req.json<{ amountUsd: string; description?: string }>();

  if (!body.amountUsd || parseFloat(body.amountUsd) <= 0) {
    throw new ValidationError('amountUsd must be a positive number');
  }

  const w = await getOrCreateWallet(ctx.userId);
  const entry = await fundWallet(w.id, body.amountUsd, body.description);
  const balance = await getWalletBalance(w.id);

  return c.json({ ledgerEntry: entry, balance }, 201);
});

wallet.post('/fund/checkout', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    amountUsd: number;
    successUrl: string;
    cancelUrl: string;
  }>();

  if (!body.amountUsd || body.amountUsd <= 0) {
    throw new ValidationError('amountUsd must be a positive number');
  }
  if (!body.successUrl || !body.cancelUrl) {
    throw new ValidationError('successUrl and cancelUrl are required');
  }

  const w = await getOrCreateWallet(ctx.userId);
  const result = await createCheckoutSession(
    ctx.userId,
    w.id,
    body.amountUsd,
    body.successUrl,
    body.cancelUrl,
  );

  return c.json(result, 201);
});

export { wallet as walletRoutes };
