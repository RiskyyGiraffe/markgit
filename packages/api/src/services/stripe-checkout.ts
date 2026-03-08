import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stripeCheckoutSessions } from '../db/schema.js';
import { stripe } from '../lib/stripe.js';
import { fundWallet } from './wallet.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';

export async function createCheckoutSession(
  userId: string,
  walletId: string,
  amountUsd: number,
  successUrl: string,
  cancelUrl: string,
) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amountUsd * 100), // cents
          product_data: {
            name: 'markgit Wallet Funding',
            description: `Add $${amountUsd.toFixed(2)} to your markgit wallet`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { userId, walletId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  await db.insert(stripeCheckoutSessions).values({
    userId,
    walletId,
    stripeSessionId: session.id,
    amountUsd: amountUsd.toFixed(4),
  });

  return { checkoutUrl: session.url!, sessionId: session.id };
}

export async function handleCheckoutCompleted(stripeSessionId: string) {
  const [existing] = await db
    .select()
    .from(stripeCheckoutSessions)
    .where(eq(stripeCheckoutSessions.stripeSessionId, stripeSessionId))
    .limit(1);

  if (!existing) throw new NotFoundError('Checkout session');

  // Idempotent: skip if already completed
  if (existing.status === 'completed') return;

  await fundWallet(existing.walletId, existing.amountUsd, 'Stripe checkout funding');

  await db
    .update(stripeCheckoutSessions)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(stripeCheckoutSessions.id, existing.id));
}

export async function handleCheckoutExpired(stripeSessionId: string) {
  const [existing] = await db
    .select()
    .from(stripeCheckoutSessions)
    .where(eq(stripeCheckoutSessions.stripeSessionId, stripeSessionId))
    .limit(1);

  if (!existing) return;
  if (existing.status !== 'pending') return;

  await db
    .update(stripeCheckoutSessions)
    .set({ status: 'expired' })
    .where(eq(stripeCheckoutSessions.id, existing.id));
}
