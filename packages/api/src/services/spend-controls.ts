import { and, count, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  purchases,
  toolCallRequests,
  toolSpendControls,
  userSpendControls,
} from '../db/schema.js';
import { RateLimitError, SpendLimitError } from '../lib/errors.js';

export type GlobalSpendControlUpdate = {
  maxPerCallUsd?: string;
  dailyLimitUsd?: string;
  monthlyLimitUsd?: string;
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
};

export type ToolSpendControlUpdate = {
  allowed?: boolean;
  maxPerCallUsd?: string | null;
  dailyLimitUsd?: string | null;
  monthlyLimitUsd?: string | null;
  rateLimitPerMinute?: number | null;
  rateLimitPerHour?: number | null;
};

function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function utcMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function subtractMilliseconds(now: Date, milliseconds: number) {
  return new Date(now.getTime() - milliseconds);
}

function remaining(limit: string | null, used: string) {
  if (limit == null) return null;
  return Math.max(0, Number.parseFloat(limit) - Number.parseFloat(used)).toFixed(4);
}

export async function getOrCreateGlobalSpendControls(userId: string) {
  await db
    .insert(userSpendControls)
    .values({ userId })
    .onConflictDoNothing({ target: userSpendControls.userId });

  const [controls] = await db
    .select()
    .from(userSpendControls)
    .where(eq(userSpendControls.userId, userId))
    .limit(1);

  return controls;
}

export async function updateGlobalSpendControls(userId: string, update: GlobalSpendControlUpdate) {
  await getOrCreateGlobalSpendControls(userId);
  const [controls] = await db
    .update(userSpendControls)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(userSpendControls.userId, userId))
    .returning();
  return controls;
}

export async function getToolSpendControls(userId: string, productId: string) {
  const [controls] = await db
    .select()
    .from(toolSpendControls)
    .where(and(eq(toolSpendControls.userId, userId), eq(toolSpendControls.productId, productId)))
    .limit(1);
  return controls ?? null;
}

export async function updateToolSpendControls(userId: string, productId: string, update: ToolSpendControlUpdate) {
  const [controls] = await db
    .insert(toolSpendControls)
    .values({ userId, productId, ...update })
    .onConflictDoUpdate({
      target: [toolSpendControls.userId, toolSpendControls.productId],
      set: { ...update, updatedAt: new Date() },
    })
    .returning();
  return controls;
}

export async function deleteToolSpendControls(userId: string, productId: string) {
  await db
    .delete(toolSpendControls)
    .where(and(eq(toolSpendControls.userId, userId), eq(toolSpendControls.productId, productId)));
}

async function completedSpend(userId: string, since: Date, productId?: string) {
  const conditions = [
    eq(purchases.userId, userId),
    eq(purchases.status, 'completed' as const),
    gte(purchases.createdAt, since),
  ];
  if (productId) conditions.push(eq(purchases.productId, productId));

  const [result] = await db
    .select({ total: sql<string>`coalesce(sum(${purchases.totalUsd}), '0')` })
    .from(purchases)
    .where(and(...conditions));
  return Number.parseFloat(result.total).toFixed(4);
}

async function recentCallCount(userId: string, since: Date, productId?: string) {
  const conditions = [
    eq(toolCallRequests.userId, userId),
    inArray(toolCallRequests.status, ['processing', 'completed']),
    gte(toolCallRequests.createdAt, since),
  ];
  if (productId) conditions.push(eq(toolCallRequests.productId, productId));

  const [result] = await db
    .select({ value: count() })
    .from(toolCallRequests)
    .where(and(...conditions));
  return result.value;
}

export async function getSpendControlPreview(userId: string, productId: string, requestedUsd: string) {
  const now = new Date();
  const global = await getOrCreateGlobalSpendControls(userId);
  const tool = await getToolSpendControls(userId, productId);
  const [globalDaily, globalMonthly, toolDaily, toolMonthly, globalMinute, globalHour, toolMinute, toolHour] =
    await Promise.all([
      completedSpend(userId, utcDayStart(now)),
      completedSpend(userId, utcMonthStart(now)),
      completedSpend(userId, utcDayStart(now), productId),
      completedSpend(userId, utcMonthStart(now), productId),
      recentCallCount(userId, subtractMilliseconds(now, 60_000)),
      recentCallCount(userId, subtractMilliseconds(now, 3_600_000)),
      recentCallCount(userId, subtractMilliseconds(now, 60_000), productId),
      recentCallCount(userId, subtractMilliseconds(now, 3_600_000), productId),
    ]);

  const violations: string[] = [];
  const requested = Number.parseFloat(requestedUsd);
  if (requested > Number.parseFloat(global.maxPerCallUsd)) {
    violations.push(`Call cost exceeds global per-call limit of $${global.maxPerCallUsd}`);
  }
  if (Number.parseFloat(globalDaily) + requested > Number.parseFloat(global.dailyLimitUsd)) {
    violations.push(`Call would exceed global daily limit of $${global.dailyLimitUsd}`);
  }
  if (Number.parseFloat(globalMonthly) + requested > Number.parseFloat(global.monthlyLimitUsd)) {
    violations.push(`Call would exceed global monthly limit of $${global.monthlyLimitUsd}`);
  }
  if (tool?.allowed === false) violations.push('This tool is blocked by its spend control');
  if (tool?.maxPerCallUsd && requested > Number.parseFloat(tool.maxPerCallUsd)) {
    violations.push(`Call cost exceeds this tool's per-call limit of $${tool.maxPerCallUsd}`);
  }
  if (tool?.dailyLimitUsd && Number.parseFloat(toolDaily) + requested > Number.parseFloat(tool.dailyLimitUsd)) {
    violations.push(`Call would exceed this tool's daily limit of $${tool.dailyLimitUsd}`);
  }
  if (tool?.monthlyLimitUsd && Number.parseFloat(toolMonthly) + requested > Number.parseFloat(tool.monthlyLimitUsd)) {
    violations.push(`Call would exceed this tool's monthly limit of $${tool.monthlyLimitUsd}`);
  }

  return {
    approved: violations.length === 0,
    violations,
    requestedUsd,
    global: {
      maxPerCallUsd: global.maxPerCallUsd,
      dailyLimitUsd: global.dailyLimitUsd,
      monthlyLimitUsd: global.monthlyLimitUsd,
      dailyUsedUsd: globalDaily,
      monthlyUsedUsd: globalMonthly,
      dailyRemainingUsd: remaining(global.dailyLimitUsd, globalDaily),
      monthlyRemainingUsd: remaining(global.monthlyLimitUsd, globalMonthly),
      rateLimitPerMinute: global.rateLimitPerMinute,
      rateLimitPerHour: global.rateLimitPerHour,
      callsLastMinute: globalMinute,
      callsLastHour: globalHour,
    },
    tool: {
      inherited: !tool,
      allowed: tool?.allowed ?? true,
      maxPerCallUsd: tool?.maxPerCallUsd ?? null,
      dailyLimitUsd: tool?.dailyLimitUsd ?? null,
      monthlyLimitUsd: tool?.monthlyLimitUsd ?? null,
      dailyUsedUsd: toolDaily,
      monthlyUsedUsd: toolMonthly,
      dailyRemainingUsd: remaining(tool?.dailyLimitUsd ?? null, toolDaily),
      monthlyRemainingUsd: remaining(tool?.monthlyLimitUsd ?? null, toolMonthly),
      rateLimitPerMinute: tool?.rateLimitPerMinute ?? null,
      rateLimitPerHour: tool?.rateLimitPerHour ?? null,
      callsLastMinute: toolMinute,
      callsLastHour: toolHour,
    },
  };
}

export async function enforceSpendLimits(userId: string, productId: string, requestedUsd: string) {
  const preview = await getSpendControlPreview(userId, productId, requestedUsd);
  if (!preview.approved) throw new SpendLimitError(preview.violations[0]);
  return preview;
}

export async function enforceRateLimits(userId: string, productId: string) {
  const now = new Date();
  const global = await getOrCreateGlobalSpendControls(userId);
  const tool = await getToolSpendControls(userId, productId);
  const [globalMinute, globalHour, toolMinute, toolHour] = await Promise.all([
    recentCallCount(userId, subtractMilliseconds(now, 60_000)),
    recentCallCount(userId, subtractMilliseconds(now, 3_600_000)),
    recentCallCount(userId, subtractMilliseconds(now, 60_000), productId),
    recentCallCount(userId, subtractMilliseconds(now, 3_600_000), productId),
  ]);

  if (globalMinute > global.rateLimitPerMinute) {
    throw new RateLimitError(`Global rate limit of ${global.rateLimitPerMinute} calls/minute exceeded`);
  }
  if (globalHour > global.rateLimitPerHour) {
    throw new RateLimitError(`Global rate limit of ${global.rateLimitPerHour} calls/hour exceeded`, 3600);
  }
  if (tool?.rateLimitPerMinute != null && toolMinute > tool.rateLimitPerMinute) {
    throw new RateLimitError(`Tool rate limit of ${tool.rateLimitPerMinute} calls/minute exceeded`);
  }
  if (tool?.rateLimitPerHour != null && toolHour > tool.rateLimitPerHour) {
    throw new RateLimitError(`Tool rate limit of ${tool.rateLimitPerHour} calls/hour exceeded`, 3600);
  }
}
