import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wallets, walletLedgerEntries, holds } from '../db/schema.js';
import { NotFoundError, InsufficientFundsError } from '../lib/errors.js';
import { ensureHoldIsActive } from '../lib/marketplace-guards.js';

export async function getLedgerEntries(walletId: string, limit = 50, offset = 0) {
  const entries = await db
    .select()
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.walletId, walletId))
    .orderBy(desc(walletLedgerEntries.createdAt))
    .limit(limit)
    .offset(offset);

  return { entries, total: entries.length };
}

export async function getOrCreateWallet(userId: string) {
  const [existing] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.status, 'active')))
    .limit(1);

  if (existing) return existing;

  const [wallet] = await db
    .insert(wallets)
    .values({ userId })
    .returning();

  return wallet;
}

export async function getWalletBalance(walletId: string) {
  // Sum all ledger entries to get current balance
  const [result] = await db
    .select({
      balance: sql<string>`coalesce(
        (select balance_after_usd from ${walletLedgerEntries}
         where wallet_id = ${walletId}
         order by created_at desc limit 1),
        '0'
      )`,
    })
    .from(wallets)
    .where(eq(wallets.id, walletId));

  // Sum active holds
  const [holdResult] = await db
    .select({
      totalHeld: sql<string>`coalesce(sum(${holds.amountUsd}), '0')`,
    })
    .from(holds)
    .where(and(eq(holds.walletId, walletId), eq(holds.status, 'held')));

  const balance = result?.balance ?? '0';
  const heldAmount = holdResult?.totalHeld ?? '0';
  const available = (parseFloat(balance) - parseFloat(heldAmount)).toFixed(4);

  return {
    walletId,
    balance,
    heldAmount,
    available,
  };
}

export async function fundWallet(walletId: string, amountUsd: string, description?: string) {
  const wallet = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  if (!wallet.length) throw new NotFoundError('Wallet');

  const { balance } = await getWalletBalance(walletId);
  const newBalance = (parseFloat(balance) + parseFloat(amountUsd)).toFixed(4);

  const [entry] = await db
    .insert(walletLedgerEntries)
    .values({
      walletId,
      entryType: 'credit',
      amountUsd,
      balanceAfterUsd: newBalance,
      description: description ?? 'Wallet funding',
      referenceType: 'funding',
    })
    .returning();

  return entry;
}

export async function createHold(walletId: string, amountUsd: string, purchaseId: string) {
  const { available } = await getWalletBalance(walletId);

  if (parseFloat(available) < parseFloat(amountUsd)) {
    throw new InsufficientFundsError();
  }

  const [hold] = await db
    .insert(holds)
    .values({ walletId, amountUsd, purchaseId })
    .returning();

  // Record hold in ledger
  const { balance } = await getWalletBalance(walletId);
  await db.insert(walletLedgerEntries).values({
    walletId,
    entryType: 'hold',
    amountUsd,
    balanceAfterUsd: balance,
    description: 'Funds held for purchase',
    referenceType: 'hold',
    referenceId: hold.id,
  });

  return hold;
}

export async function captureHold(holdId: string) {
  const [hold] = await db
    .select()
    .from(holds)
    .where(eq(holds.id, holdId))
    .limit(1);

  if (!hold) throw new NotFoundError('Hold');
  ensureHoldIsActive(hold.status);

  await db
    .update(holds)
    .set({ status: 'captured', updatedAt: new Date() })
    .where(eq(holds.id, holdId));

  const { balance } = await getWalletBalance(hold.walletId);
  const newBalance = (parseFloat(balance) - parseFloat(hold.amountUsd)).toFixed(4);

  await db.insert(walletLedgerEntries).values({
    walletId: hold.walletId,
    entryType: 'capture',
    amountUsd: hold.amountUsd,
    balanceAfterUsd: newBalance,
    description: 'Hold captured for completed purchase',
    referenceType: 'hold',
    referenceId: holdId,
  });
}

export async function releaseHold(holdId: string) {
  const [hold] = await db
    .select()
    .from(holds)
    .where(eq(holds.id, holdId))
    .limit(1);

  if (!hold) throw new NotFoundError('Hold');
  ensureHoldIsActive(hold.status);

  await db
    .update(holds)
    .set({ status: 'released', updatedAt: new Date() })
    .where(eq(holds.id, holdId));

  const { balance } = await getWalletBalance(hold.walletId);

  await db.insert(walletLedgerEntries).values({
    walletId: hold.walletId,
    entryType: 'release',
    amountUsd: hold.amountUsd,
    balanceAfterUsd: balance,
    description: 'Hold released',
    referenceType: 'hold',
    referenceId: holdId,
  });
}
