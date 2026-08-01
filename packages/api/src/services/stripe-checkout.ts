import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stripeCheckoutSessions, walletLedgerEntries, wallets } from '../db/schema.js';
import { stripe } from '../lib/stripe.js';
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
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${stripeSessionId}, 0))`);
    const [existing] = await tx
      .select()
      .from(stripeCheckoutSessions)
      .where(eq(stripeCheckoutSessions.stripeSessionId, stripeSessionId))
      .limit(1);

    if (!existing) throw new NotFoundError('Checkout session');
    if (existing.status === 'completed') return;
    if (existing.status !== 'pending') {
      throw new ConflictError(`Checkout session is already ${existing.status}`);
    }

    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${existing.walletId}, 0))`);
    const [balanceResult] = await tx
      .select({
        balance: sql<string>`coalesce(
          (select balance_after_usd from ${walletLedgerEntries}
           where wallet_id = ${existing.walletId}
           order by created_at desc limit 1),
          '0'
        )`,
      })
      .from(wallets)
      .where(eq(wallets.id, existing.walletId));
    if (!balanceResult) throw new NotFoundError('Wallet');

    const [claimed] = await tx
      .update(stripeCheckoutSessions)
      .set({ status: 'completed', completedAt: new Date() })
      .where(and(
        eq(stripeCheckoutSessions.id, existing.id),
        eq(stripeCheckoutSessions.status, 'pending'),
      ))
      .returning({ id: stripeCheckoutSessions.id });
    if (!claimed) return;

    const newBalance = (
      Number.parseFloat(balanceResult.balance) + Number.parseFloat(existing.amountUsd)
    ).toFixed(4);
    await tx.insert(walletLedgerEntries).values({
      walletId: existing.walletId,
      entryType: 'credit',
      amountUsd: existing.amountUsd,
      balanceAfterUsd: newBalance,
      description: 'Stripe checkout funding',
      referenceType: 'funding',
      referenceId: existing.id,
    });
  });
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
