import { Hono } from 'hono';
import { createQuote, createPurchase, listPurchases } from '../services/purchases.js';
import { getOrCreateWallet } from '../services/wallet.js';
import { ValidationError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';

type Env = { Variables: { auth: AuthContext } };

const purchases = new Hono<Env>();

purchases.get('/', async (c) => {
  const { auth: ctx } = c.var;
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const result = await listPurchases(ctx.userId, limit, offset);
  return c.json(result);
});

purchases.post('/', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{ productId: string; quoteId: string; input?: Record<string, unknown> }>();

  if (!body.productId || !body.quoteId) {
    throw new ValidationError('productId and quoteId are required');
  }

  const result = await createPurchase(ctx.userId, {
    productId: body.productId,
    quoteId: body.quoteId,
    input: body.input ?? {},
    apiKeyId: ctx.apiKeyId,
  });
  return c.json(result, 201);
});

const quotes = new Hono<Env>();

quotes.post('/', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{ productId: string; walletId?: string }>();

  if (!body.productId) {
    throw new ValidationError('productId is required');
  }

  let walletId = body.walletId;
  if (!walletId) {
    const w = await getOrCreateWallet(ctx.userId);
    walletId = w.id;
  }

  const quote = await createQuote(ctx.userId, body.productId, walletId);
  return c.json(quote, 201);
});

export { purchases as purchaseRoutes, quotes as quoteRoutes };
