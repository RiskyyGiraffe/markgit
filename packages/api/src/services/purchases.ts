import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  quotes,
  purchases,
  executions,
  products,
  providerEarnings,
  wallets,
  apiKeys,
} from '../db/schema.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { createHold, captureHold, releaseHold } from './wallet.js';
import { runExecution } from './execution-engine.js';
import { hasBuyerCredential } from './credentials.js';
import {
  addUsd,
  ensureBudgetWithinLimit,
  ensureResourceOwnership,
} from '../lib/marketplace-guards.js';

const TOLTY_FEE_RATE = 0.10; // 10%
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

  const authMode = ((product.executionConfig as { auth?: { mode?: string } } | null)?.auth?.mode ??
    'none') as string;
  if (authMode === 'buyer_supplied') {
    const credentialExists = await hasBuyerCredential(userId, product.id);
    if (!credentialExists) {
      throw new ValidationError('This product requires a saved buyer credential before quoting');
    }
  }

  const price = parseFloat(product.pricePerCallUsd);
  const fee = parseFloat((price * TOLTY_FEE_RATE).toFixed(4));
  const total = parseFloat((price + fee).toFixed(4));

  const [quote] = await db
    .insert(quotes)
    .values({
      userId,
      productId,
      walletId,
      priceUsd: price.toFixed(4),
      toltyFeeUsd: fee.toFixed(4),
      totalUsd: total.toFixed(4),
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    })
    .returning();

  return quote;
}

export async function createPurchase(
  userId: string,
  data: { productId: string; quoteId: string; input?: Record<string, unknown>; apiKeyId: string },
) {
  const input = data.input ?? {};

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, data.quoteId))
    .limit(1);

  if (!quote) throw new NotFoundError('Quote');
  ensureResourceOwnership('Quote', quote.userId, userId);

  if (quote.status !== 'active') {
    throw new ValidationError('Quote is no longer active');
  }

  if (quote.expiresAt < new Date()) {
    await db.update(quotes).set({ status: 'expired' }).where(eq(quotes.id, quote.id));
    throw new ValidationError('Quote has expired');
  }

  if (quote.productId !== data.productId) {
    throw new ValidationError('Quote product mismatch');
  }

  // Validate product is active
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, data.productId))
    .limit(1);

  if (!product) throw new NotFoundError('Product');
  if (product.status !== 'active') {
    throw new ValidationError('Product is not active');
  }

  const [wallet] = await db
    .select({ userId: wallets.userId })
    .from(wallets)
    .where(eq(wallets.id, quote.walletId))
    .limit(1);

  if (!wallet) throw new NotFoundError('Wallet');
  ensureResourceOwnership('Wallet', wallet.userId, userId);

  const [apiKey] = await db
    .select({
      budgetLimitUsd: apiKeys.budgetLimitUsd,
      budgetUsedUsd: apiKeys.budgetUsedUsd,
      userId: apiKeys.userId,
    })
    .from(apiKeys)
    .where(eq(apiKeys.id, data.apiKeyId))
    .limit(1);

  if (!apiKey) throw new NotFoundError('API key');
  if (apiKey.userId !== userId) {
    throw new ForbiddenError('API key does not belong to the authenticated user');
  }

  ensureBudgetWithinLimit(apiKey.budgetLimitUsd, apiKey.budgetUsedUsd, quote.totalUsd);

  // Create hold on wallet
  const hold = await createHold(quote.walletId, quote.totalUsd, '00000000-0000-0000-0000-000000000000');

  // Create purchase first (without executionId)
  const [purchase] = await db
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

  // Create execution record with real purchaseId
  const [execution] = await db
    .insert(executions)
    .values({
      purchaseId: purchase.id,
      productId: data.productId,
      status: 'pending',
      input,
    })
    .returning();

  // Link execution back to purchase
  await db
    .update(purchases)
    .set({ executionId: execution.id })
    .where(eq(purchases.id, purchase.id));

  // Consume the quote
  await db
    .update(quotes)
    .set({ status: 'consumed' })
    .where(eq(quotes.id, quote.id));

  // Run execution synchronously
  const result = await runExecution(execution.id, data.productId, userId, input);

  if (result.success) {
    // Capture the hold (debit wallet)
    await captureHold(hold.id);

    await db
      .update(apiKeys)
      .set({
        budgetUsedUsd: addUsd(apiKey.budgetUsedUsd, quote.totalUsd),
      })
      .where(and(eq(apiKeys.id, data.apiKeyId), eq(apiKeys.userId, userId)));

    // Mark purchase as completed
    await db
      .update(purchases)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(purchases.id, purchase.id));

    // Record provider earnings
    const grossAmount = parseFloat(quote.priceUsd);
    const toltyFee = parseFloat(quote.toltyFeeUsd);
    const netAmount = parseFloat((grossAmount - toltyFee).toFixed(4));

    await db.insert(providerEarnings).values({
      providerId: product.providerId,
      purchaseId: purchase.id,
      grossAmountUsd: grossAmount.toFixed(4),
      toltyFeeUsd: toltyFee.toFixed(4),
      netAmountUsd: netAmount.toFixed(4),
      payoutEligibleAt: new Date(),
    });
  } else {
    // Release the hold (return funds)
    await releaseHold(hold.id);

    // Mark purchase as failed
    await db
      .update(purchases)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(purchases.id, purchase.id));
  }

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
