import { Hono } from 'hono';
import { stripe } from '../lib/stripe.js';
import { handleCheckoutCompleted, handleCheckoutExpired } from '../services/stripe-checkout.js';
import { handleAccountUpdated } from '../services/stripe-connect.js';

const webhooks = new Hono();

webhooks.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  const rawBody = await c.req.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(session.id);
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        await handleCheckoutExpired(session.id);
        break;
      }
      case 'account.updated': {
        const account = event.data.object;
        await handleAccountUpdated(account);
        break;
      }
      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    console.error(`Error handling webhook ${event.type}:`, err);
    return c.json({ error: 'Webhook handler failed' }, 500);
  }

  return c.json({ received: true });
});

export { webhooks as webhookRoutes };
