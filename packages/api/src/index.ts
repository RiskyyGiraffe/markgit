import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { authMiddleware } from './middleware/auth.js';
import { sessionMiddleware } from './middleware/session.js';
import { authRoutes } from './routes/auth.js';
import { walletRoutes } from './routes/wallet.js';
import { searchRoutes } from './routes/search.js';
import { productRoutes } from './routes/products.js';
import { purchaseRoutes, quoteRoutes } from './routes/purchases.js';
import { executionRoutes } from './routes/executions.js';
import { providerRoutes } from './routes/providers.js';
import { providerStripeRoutes } from './routes/provider-stripe.js';
import { webhookRoutes } from './routes/webhooks.js';
import { AppError } from './lib/errors.js';
import { runDailyPayouts } from './services/stripe-connect.js';

const app = new Hono();

// Health check (no auth)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Webhooks (no auth — signature-verified internally)
app.route('/webhooks', webhookRoutes);

// Authenticated v1 routes
const v1 = new Hono();
v1.use('*', authMiddleware);
v1.use('*', sessionMiddleware);

v1.route('/auth', authRoutes);
v1.route('/wallet', walletRoutes);
v1.route('/search', searchRoutes);
v1.route('/products', productRoutes);
v1.route('/purchases', purchaseRoutes);
v1.route('/quotes', quoteRoutes);
v1.route('/executions', executionRoutes);
v1.route('/providers', providerStripeRoutes);
v1.route('/providers', providerRoutes);

app.route('/v1', v1);

// Global error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.statusCode as any,
    );
  }

  console.error('Unhandled error:', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500,
  );
});

const port = parseInt(process.env.PORT ?? '3000', 10);
console.log(`markgit API starting on port ${port}`);

serve({ fetch: app.fetch, port });

// Daily payout cron — runs every 24h
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(async () => {
  console.log('[cron] Running daily payouts...');
  try {
    const results = await runDailyPayouts();
    console.log('[cron] Daily payouts complete:', JSON.stringify(results));
  } catch (err) {
    console.error('[cron] Daily payouts failed:', err);
  }
}, TWENTY_FOUR_HOURS);

export default app;
