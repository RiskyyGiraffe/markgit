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
import { providerImportRoutes } from './routes/provider-imports.js';
import { webhookRoutes } from './routes/webhooks.js';
import { AppError } from './lib/errors.js';
import { runDueJobs, schedulePayoutSweep } from './services/jobs.js';

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
v1.route('/provider-imports', providerImportRoutes);

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

async function bootstrapJobs() {
  try {
    await schedulePayoutSweep();
  } catch (err) {
    console.error('[jobs] Failed to schedule payout sweep:', err);
  }
}

bootstrapJobs();

const JOB_POLL_INTERVAL_MS = 60_000;
setInterval(async () => {
  try {
    const results = await runDueJobs();
    if (results.length > 0) {
      console.log('[jobs] processed:', JSON.stringify(results));
    }
  } catch (err) {
    console.error('[jobs] worker failure:', err);
  }
}, JOB_POLL_INTERVAL_MS);

export default app;
