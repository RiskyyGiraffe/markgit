import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { quotes, purchases, executions, products, providerEarnings } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { createHold, captureHold, releaseHold } from './wallet.js';
import { runExecution } from './execution-engine.js';

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
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new NotFoundError('Product');

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
  data: { productId: string; quoteId: string; input?: Record<string, unknown> },
) {
  const input = data.input ?? {};

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, data.quoteId))
    .limit(1);

  if (!quote) throw new NotFoundError('Quote');

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
  const result = await runExecution(execution.id, data.productId, input);

  if (result.success) {
    // Capture the hold (debit wallet)
    await captureHold(hold.id);

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
    purchase: { ...purchase, status: result.success ? 'completed' : 'failed' },
    executionId: execution.id,
    execution: {
      status: result.success ? 'completed' : 'failed',
      output: result.output,
      errorMessage: result.errorMessage,
    },
  };
}
