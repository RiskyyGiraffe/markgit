import { eq, and, sql, isNull, isNotNull, lte, desc, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { providers, providerEarnings, payouts, products, purchases } from '../db/schema.js';
import { stripe } from '../lib/stripe.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type Stripe from 'stripe';

export async function createConnectAccount(providerId: string) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  if (!provider) throw new NotFoundError('Provider');

  if (provider.stripeAccountId) {
    return { accountId: provider.stripeAccountId };
  }

  let account: Stripe.Account;
  try {
    account = await stripe.accounts.create({
      type: 'express',
      metadata: { providerId },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("signed up for Connect")) {
      throw new ValidationError(
        'Stripe Connect is not enabled on this Stripe account. Enable Connect in the Stripe dashboard first.',
      );
    }

    throw err;
  }

  await db
    .update(providers)
    .set({
      stripeAccountId: account.id,
      stripeAccountStatus: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(providers.id, providerId));

  return { accountId: account.id };
}

export async function createAccountLink(
  providerId: string,
  refreshUrl: string,
  returnUrl: string,
) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  if (!provider) throw new NotFoundError('Provider');
  if (!provider.stripeAccountId) {
    throw new ValidationError('Stripe account not created yet. Call connect first.');
  }

  const link = await stripe.accountLinks.create({
    account: provider.stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return { url: link.url };
}

export async function createDashboardLink(providerId: string) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  if (!provider) throw new NotFoundError('Provider');
  if (!provider.stripeAccountId) {
    throw new ValidationError('No Stripe account connected');
  }

  const link = await stripe.accounts.createLoginLink(provider.stripeAccountId);
  return { url: link.url };
}

export async function handleAccountUpdated(account: Stripe.Account) {
  const stripeAccountId = account.id;

  let status = 'pending';
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'active';
  } else if (account.requirements?.disabled_reason) {
    status = 'restricted';
  }

  await db
    .update(providers)
    .set({ stripeAccountStatus: status, updatedAt: new Date() })
    .where(eq(providers.stripeAccountId, stripeAccountId));
}

export async function getStripeStatus(providerId: string) {
  const [provider] = await db
    .select({
      stripeAccountId: providers.stripeAccountId,
      stripeAccountStatus: providers.stripeAccountStatus,
    })
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  if (!provider) throw new NotFoundError('Provider');

  return {
    accountId: provider.stripeAccountId,
    status: provider.stripeAccountStatus ?? 'none',
  };
}

export async function getEarningsSummary(providerId: string) {
  const [result] = await db
    .select({
      totalGross: sql<string>`coalesce(sum(${providerEarnings.grossAmountUsd}), '0')`,
      totalFees: sql<string>`coalesce(sum(${providerEarnings.toltyFeeUsd}), '0')`,
      totalNet: sql<string>`coalesce(sum(${providerEarnings.netAmountUsd}), '0')`,
      unpaid: sql<string>`coalesce(sum(case when ${providerEarnings.payoutId} is null then ${providerEarnings.netAmountUsd} else 0 end), '0')`,
      paidOut: sql<string>`coalesce(sum(case when ${providerEarnings.payoutId} is not null then ${providerEarnings.netAmountUsd} else 0 end), '0')`,
    })
    .from(providerEarnings)
    .where(eq(providerEarnings.providerId, providerId));

  return {
    totalGross: result.totalGross,
    totalFees: result.totalFees,
    totalNet: result.totalNet,
    unpaid: result.unpaid,
    paidOut: result.paidOut,
  };
}

export async function getUnpaidEarnings(providerId: string) {
  const [result] = await db
    .select({
      total: sql<string>`coalesce(sum(${providerEarnings.netAmountUsd}), '0')`,
    })
    .from(providerEarnings)
    .where(
      and(
        eq(providerEarnings.providerId, providerId),
        isNull(providerEarnings.payoutId),
        lte(providerEarnings.payoutEligibleAt, new Date()),
      ),
    );

  return parseFloat(result.total);
}

export async function createPayout(providerId: string) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  if (!provider) throw new NotFoundError('Provider');
  if (!provider.stripeAccountId || provider.stripeAccountStatus !== 'active') {
    throw new ValidationError('Stripe account is not active');
  }

  const unpaidAmount = await getUnpaidEarnings(providerId);
  if (unpaidAmount < 1.0) {
    throw new ValidationError('Minimum payout is $1.00');
  }

  // Create payout record
  const [payout] = await db
    .insert(payouts)
    .values({
      providerId,
      amountUsd: unpaidAmount.toFixed(4),
      status: 'processing',
    })
    .returning();

  try {
    // Create Stripe transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(unpaidAmount * 100), // cents
      currency: 'usd',
      destination: provider.stripeAccountId,
      metadata: { payoutId: payout.id, providerId },
    });

    // Update payout with transfer ID and mark completed
    await db
      .update(payouts)
      .set({
        stripeTransferId: transfer.id,
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(payouts.id, payout.id));

    // Link earnings to this payout
    await db
      .update(providerEarnings)
      .set({ payoutId: payout.id })
      .where(
        and(
          eq(providerEarnings.providerId, providerId),
          isNull(providerEarnings.payoutId),
          lte(providerEarnings.payoutEligibleAt, new Date()),
        ),
      );

    return { ...payout, status: 'completed', stripeTransferId: transfer.id };
  } catch (err) {
    // Mark payout as failed
    await db
      .update(payouts)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(payouts.id, payout.id));
    throw err;
  }
}

export async function listPayouts(providerId: string) {
  const results = await db
    .select()
    .from(payouts)
    .where(eq(payouts.providerId, providerId))
    .orderBy(desc(payouts.createdAt));

  return { results };
}

export async function listEarnings(providerId: string, limit = 50, offset = 0) {
  const results = await db
    .select({
      id: providerEarnings.id,
      purchaseId: providerEarnings.purchaseId,
      productName: products.name,
      grossAmountUsd: providerEarnings.grossAmountUsd,
      toltyFeeUsd: providerEarnings.toltyFeeUsd,
      netAmountUsd: providerEarnings.netAmountUsd,
      payoutId: providerEarnings.payoutId,
      createdAt: providerEarnings.createdAt,
    })
    .from(providerEarnings)
    .innerJoin(purchases, eq(providerEarnings.purchaseId, purchases.id))
    .innerJoin(products, eq(purchases.productId, products.id))
    .where(eq(providerEarnings.providerId, providerId))
    .orderBy(desc(providerEarnings.createdAt))
    .limit(limit)
    .offset(offset);

  return { results, total: results.length };
}

/** Run daily payouts for all providers with active Stripe accounts and ≥$1 unpaid. */
export async function runDailyPayouts() {
  const eligibleProviders = await db
    .select({ id: providers.id, stripeAccountId: providers.stripeAccountId })
    .from(providers)
    .where(
      and(
        eq(providers.stripeAccountStatus, 'active'),
        isNotNull(providers.stripeAccountId),
      ),
    );

  const results: Array<{ providerId: string; status: string; amount?: string; error?: string }> = [];

  for (const provider of eligibleProviders) {
    try {
      const unpaidAmount = await getUnpaidEarnings(provider.id);
      if (unpaidAmount < 1.0) {
        results.push({ providerId: provider.id, status: 'skipped', amount: unpaidAmount.toFixed(4) });
        continue;
      }

      const payout = await createPayout(provider.id);
      results.push({ providerId: provider.id, status: 'completed', amount: payout.amountUsd });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Daily payout failed for provider ${provider.id}:`, message);
      results.push({ providerId: provider.id, status: 'failed', error: message });
    }
  }

  return results;
}
