import { eq, and, desc, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  quotes,
  purchases,
  executions,
  products,
  providerEarnings,
  wallets,
  apiKeys,
  holds,
  walletLedgerEntries,
  providers,
  userToolApprovals,
  providerOriginVerifications,
} from '../db/schema.js';
import {
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
  ToolApprovalError,
  ToolPolicyBlockedError,
} from '../lib/errors.js';
import { runExecution } from './execution-engine.js';
import { enforceSpendLimits } from './spend-controls.js';
import { hasBuyerCredential } from './credentials.js';
import { ensureHoldIsActive, ensureResourceOwnership } from '../lib/marketplace-guards.js';
import {
  computeToolPolicy,
  endpointMatchesVerifiedOrigin,
  normalizeToolCapabilities,
} from '../lib/tool-policy.js';
import { ensureProductVersion } from './product-versions.js';

const MARKGIT_FEE_RATE = 0.10; // 10%
const QUOTE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function listPurchases(userId: string, limit = 50, offset = 0) {
  const results = await db
    .select({
      id: purchases.id,
      productId: purchases.productId,
      productName: products.name,
      status: purchases.status,
      totalUsd: purchases.totalUsd,
      executionId: purchases.executionId,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(products, eq(purchases.productId, products.id))
    .where(eq(purchases.userId, userId))
    .orderBy(desc(purchases.createdAt))
    .limit(limit)
    .offset(offset);

  return { results, total: results.length };
}

export async function createQuote(userId: string, productId: string, walletId: string) {
  const [wallet] = await db
    .select({ userId: wallets.userId })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);

  if (!wallet) throw new NotFoundError('Wallet');
  ensureResourceOwnership('Wallet', wallet.userId, userId);

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new NotFoundError('Product');
  if (product.status !== 'active') {
    throw new ValidationError('Product is not active');
  }

  const version = await ensureProductVersion(product.id);
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, product.providerId))
    .limit(1);
  if (!provider) throw new NotFoundError('Provider');
  const verifiedOrigins = await db
    .select({ origin: providerOriginVerifications.origin })
    .from(providerOriginVerifications)
    .where(and(
      eq(providerOriginVerifications.providerId, provider.id),
      eq(providerOriginVerifications.status, 'verified'),
      gt(providerOriginVerifications.expiresAt, new Date()),
    ));
  const capabilities = normalizeToolCapabilities(version.capabilities, product.executionConfig);
  const policy = computeToolPolicy({
    productStatus: product.status,
    moderationStatus: product.moderationStatus,
    pricePerCallUsd: product.pricePerCallUsd,
    manifestDigest: version.manifestDigest,
    capabilities,
    endpointVerified: endpointMatchesVerifiedOrigin(
      product.executionConfig,
      verifiedOrigins.map((entry) => entry.origin),
    ),
    paymentVerified: provider.stripeAccountStatus === 'active',
  });

  const authMode = ((product.executionConfig as { auth?: { mode?: string } } | null)?.auth?.mode ??
    'none') as string;
  if (authMode === 'buyer_supplied') {
    const credentialExists = await hasBuyerCredential(userId, product.id);
    if (!credentialExists) {
      throw new ValidationError('This product requires a saved buyer credential before quoting');
    }
  }

  const price = parseFloat(product.pricePerCallUsd);
  const fee = parseFloat((price * MARKGIT_FEE_RATE).toFixed(4));
  const total = parseFloat((price + fee).toFixed(4));

  const [quote] = await db
    .insert(quotes)
    .values({
      userId,
      productId,
      walletId,
      priceUsd: price.toFixed(4),
      markgitFeeUsd: fee.toFixed(4),
      totalUsd: total.toFixed(4),
      manifestDigest: version.manifestDigest,
      policySnapshot: policy as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    })
    .returning();

  return quote;
}

export async function createPurchase(
  userId: string,
  data: {
    productId: string;
    quoteId: string;
    input?: Record<string, unknown>;
    apiKeyId: string;
    approvalManifestDigest?: string;
  },
) {
  const input = data.input ?? {};
  const authorized = await db.transaction(async (tx) => {
    // Serialize the authorization phase per user. This makes wallet holds, spend
    // limits, API-key budgets, and quote consumption one decision even when an
    // agent launches several calls concurrently.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);

    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, data.quoteId)).limit(1);
    if (!quote) throw new NotFoundError('Quote');
    ensureResourceOwnership('Quote', quote.userId, userId);
    if (quote.status !== 'active') throw new ValidationError('Quote is no longer active');
    if (quote.expiresAt < new Date()) throw new ValidationError('Quote has expired');
    if (quote.productId !== data.productId) throw new ValidationError('Quote product mismatch');

    const [product] = await tx.select().from(products).where(eq(products.id, data.productId)).limit(1);
    if (!product) throw new NotFoundError('Product');
    if (product.status !== 'active') throw new ValidationError('Product is not active');
    if (!product.manifestDigest || quote.manifestDigest !== product.manifestDigest) {
      throw new ValidationError('Quote references an outdated tool version; request a new quote');
    }

    const [provider] = await tx
      .select()
      .from(providers)
      .where(eq(providers.id, product.providerId))
      .limit(1);
    if (!provider) throw new NotFoundError('Provider');
    const verifiedOrigins = await tx
      .select({ origin: providerOriginVerifications.origin })
      .from(providerOriginVerifications)
      .where(and(
        eq(providerOriginVerifications.providerId, provider.id),
        eq(providerOriginVerifications.status, 'verified'),
        gt(providerOriginVerifications.expiresAt, new Date()),
      ));
    const capabilities = normalizeToolCapabilities(product.capabilities, product.executionConfig);
    const policy = computeToolPolicy({
      productStatus: product.status,
      moderationStatus: product.moderationStatus,
      pricePerCallUsd: product.pricePerCallUsd,
      manifestDigest: product.manifestDigest,
      capabilities,
      endpointVerified: endpointMatchesVerifiedOrigin(
        product.executionConfig,
        verifiedOrigins.map((entry) => entry.origin),
      ),
      paymentVerified: provider.stripeAccountStatus === 'active',
    });
    if (!policy.callable || policy.approval.requirement === 'blocked') {
      throw new ToolPolicyBlockedError(policy.reasons);
    }

    const exactVersionApproved = data.approvalManifestDigest === product.manifestDigest;
    if (policy.approval.requirement === 'first_use') {
      const [existingApproval] = await tx
        .select({ id: userToolApprovals.id })
        .from(userToolApprovals)
        .where(and(
          eq(userToolApprovals.userId, userId),
          eq(userToolApprovals.productId, product.id),
          eq(userToolApprovals.manifestDigest, product.manifestDigest),
          isNull(userToolApprovals.revokedAt),
        ))
        .limit(1);
      if (!existingApproval && !exactVersionApproved) {
        throw new ToolApprovalError(
          policy.approval.requirement,
          product.manifestDigest,
          policy.reasons,
        );
      }
      if (!existingApproval) {
        await tx
          .insert(userToolApprovals)
          .values({
            userId,
            productId: product.id,
            manifestDigest: product.manifestDigest,
            approvalType: 'first_use',
          })
          .onConflictDoUpdate({
            target: [
              userToolApprovals.userId,
              userToolApprovals.productId,
              userToolApprovals.manifestDigest,
            ],
            set: { revokedAt: null, createdAt: new Date() },
          });
      }
    } else if (
      policy.approval.requirement !== 'covered_by_user_policy' &&
      !exactVersionApproved
    ) {
      throw new ToolApprovalError(
        policy.approval.requirement,
        product.manifestDigest,
        policy.reasons,
      );
    }

    const [wallet] = await tx
      .select({ userId: wallets.userId, status: wallets.status })
      .from(wallets)
      .where(eq(wallets.id, quote.walletId))
      .limit(1);
    if (!wallet) throw new NotFoundError('Wallet');
    ensureResourceOwnership('Wallet', wallet.userId, userId);
    if (wallet.status !== 'active') throw new ValidationError('Wallet is not active');
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${quote.walletId}, 0))`);

    const [apiKey] = await tx
      .select({ userId: apiKeys.userId })
      .from(apiKeys)
      .where(eq(apiKeys.id, data.apiKeyId))
      .limit(1);
    if (!apiKey) throw new NotFoundError('API key');
    if (apiKey.userId !== userId) {
      throw new ForbiddenError('API key does not belong to the authenticated user');
    }

    // Authorized purchases count as reserved spend, so a slow tool cannot be
    // used to open many calls just below a daily or monthly ceiling.
    await enforceSpendLimits(userId, data.productId, quote.totalUsd);

    const [balanceResult] = await tx
      .select({
        balance: sql<string>`coalesce(
          (select balance_after_usd from ${walletLedgerEntries}
           where wallet_id = ${quote.walletId}
           order by created_at desc limit 1),
          '0'
        )`,
      })
      .from(wallets)
      .where(eq(wallets.id, quote.walletId));
    const [holdResult] = await tx
      .select({ totalHeld: sql<string>`coalesce(sum(${holds.amountUsd}), '0')` })
      .from(holds)
      .where(and(eq(holds.walletId, quote.walletId), eq(holds.status, 'held')));
    const balance = balanceResult?.balance ?? '0';
    const available = Number.parseFloat(balance) - Number.parseFloat(holdResult?.totalHeld ?? '0');
    if (available < Number.parseFloat(quote.totalUsd)) throw new InsufficientFundsError();

    const [reservedKey] = await tx
      .update(apiKeys)
      .set({ budgetUsedUsd: sql`${apiKeys.budgetUsedUsd} + ${quote.totalUsd}::numeric` })
      .where(and(
        eq(apiKeys.id, data.apiKeyId),
        eq(apiKeys.userId, userId),
        or(
          isNull(apiKeys.budgetLimitUsd),
          sql`${apiKeys.budgetUsedUsd} + ${quote.totalUsd}::numeric <= ${apiKeys.budgetLimitUsd}`,
        ),
      ))
      .returning({ id: apiKeys.id });
    if (!reservedKey) throw new ForbiddenError('API key budget limit exceeded');

    const [claimedQuote] = await tx
      .update(quotes)
      .set({ status: 'consumed' })
      .where(and(eq(quotes.id, quote.id), eq(quotes.status, 'active')))
      .returning({ id: quotes.id });
    if (!claimedQuote) throw new ValidationError('Quote is no longer active');

    const [hold] = await tx
      .insert(holds)
      .values({ walletId: quote.walletId, amountUsd: quote.totalUsd })
      .returning();
    await tx.insert(walletLedgerEntries).values({
      walletId: quote.walletId,
      entryType: 'hold',
      amountUsd: quote.totalUsd,
      balanceAfterUsd: balance,
      description: 'Funds held for purchase',
      referenceType: 'hold',
      referenceId: hold.id,
    });

    const [purchase] = await tx
      .insert(purchases)
      .values({
        userId,
        productId: data.productId,
        quoteId: quote.id,
        holdId: hold.id,
        walletId: quote.walletId,
        status: 'authorized',
        totalUsd: quote.totalUsd,
      })
      .returning();
    await tx.update(holds).set({ purchaseId: purchase.id }).where(eq(holds.id, hold.id));

    const [execution] = await tx
      .insert(executions)
      .values({ purchaseId: purchase.id, productId: data.productId, status: 'pending', input })
      .returning();
    await tx
      .update(purchases)
      .set({ executionId: execution.id })
      .where(eq(purchases.id, purchase.id));

    return { quote, product, provider, hold, purchase, execution };
  });

  const { quote, product, provider, hold, purchase, execution } = authorized;

  // Run execution synchronously
  const result = await runExecution(execution.id, data.productId, userId, input);

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
    const [currentHold] = await tx.select().from(holds).where(eq(holds.id, hold.id)).limit(1);
    if (!currentHold) throw new NotFoundError('Hold');
    ensureHoldIsActive(currentHold.status);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${currentHold.walletId}, 0))`);

    const [balanceResult] = await tx
      .select({
        balance: sql<string>`coalesce(
          (select balance_after_usd from ${walletLedgerEntries}
           where wallet_id = ${currentHold.walletId}
           order by created_at desc limit 1),
          '0'
        )`,
      })
      .from(wallets)
      .where(eq(wallets.id, currentHold.walletId));
    const balance = balanceResult?.balance ?? '0';

    if (result.success) {
      await tx.update(holds).set({ status: 'captured', updatedAt: new Date() }).where(eq(holds.id, hold.id));
      const newBalance = (Number.parseFloat(balance) - Number.parseFloat(hold.amountUsd)).toFixed(4);
      await tx.insert(walletLedgerEntries).values({
        walletId: hold.walletId,
        entryType: 'capture',
        amountUsd: hold.amountUsd,
        balanceAfterUsd: newBalance,
        description: 'Hold captured for completed purchase',
        referenceType: 'hold',
        referenceId: hold.id,
      });
      await tx
        .update(purchases)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(purchases.id, purchase.id));
      await tx
        .insert(providerEarnings)
        .values({
          providerId: product.providerId,
          purchaseId: purchase.id,
          grossAmountUsd: quote.priceUsd,
          markgitFeeUsd: '0.0000',
          netAmountUsd: quote.priceUsd,
          payoutEligibleAt: new Date(Date.now() + (
            provider.trustTier === 'premium'
              ? 0
              : provider.trustTier === 'verified'
                ? 2
                : provider.trustTier === 'basic'
                  ? 7
                  : 14
          ) * 86_400_000),
        })
        .onConflictDoNothing({ target: providerEarnings.purchaseId });
    } else {
      await tx.update(holds).set({ status: 'released', updatedAt: new Date() }).where(eq(holds.id, hold.id));
      await tx.insert(walletLedgerEntries).values({
        walletId: hold.walletId,
        entryType: 'release',
        amountUsd: hold.amountUsd,
        balanceAfterUsd: balance,
        description: 'Hold released after failed purchase',
        referenceType: 'hold',
        referenceId: hold.id,
      });
      await tx
        .update(apiKeys)
        .set({ budgetUsedUsd: sql`greatest(0, ${apiKeys.budgetUsedUsd} - ${quote.totalUsd}::numeric)` })
        .where(and(eq(apiKeys.id, data.apiKeyId), eq(apiKeys.userId, userId)));
      await tx
        .update(purchases)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(purchases.id, purchase.id));
    }
  });

  return {
    purchase: {
      ...purchase,
      executionId: execution.id,
      status: result.success ? 'completed' : 'failed',
    },
    executionId: execution.id,
    execution: {
      status: result.success ? 'completed' : 'failed',
      output: result.output,
      errorMessage: result.errorMessage,
    },
  };
}
