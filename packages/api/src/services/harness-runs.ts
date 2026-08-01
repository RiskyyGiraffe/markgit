import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  harnessRunEvents,
  harnessRuns,
  products,
  userToolApprovals,
} from '../db/schema.js';
import { hashApiKey } from '../lib/crypto.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ToolApprovalError,
  ToolPolicyBlockedError,
  UnauthorizedError,
  ValidationError,
} from '../lib/errors.js';
import {
  validateHarnessEventAccess,
  type HarnessAccessManifest,
  type HarnessConfig,
} from '../lib/harness-manifest.js';
import { safeFetchText } from '../lib/safe-fetch.js';

type HarnessEventInput = {
  type: string;
  message?: string;
  data?: Record<string, unknown>;
};

const EVENT_TYPES = new Set([
  'run.started',
  'run.heartbeat',
  'run.waiting',
  'run.completed',
  'run.failed',
  'loop.step.started',
  'loop.step.completed',
  'external_api.call',
  'markgit_tool.call',
  'compaction.started',
  'compaction.completed',
  'checkpoint.created',
  'message',
]);

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function callbackToken() {
  return `mkgt_run_${randomBytes(32).toString('base64url')}`;
}

export async function approveHarnessRun(
  userId: string,
  harness: {
    id: string;
    version: { manifestDigest: string | null };
    policy: {
      callable: boolean;
      approval: { requirement: string; manifestDigest: string | null };
      reasons: string[];
    };
  },
  approvalManifestDigest?: string,
) {
  if (!harness.policy.callable || harness.policy.approval.requirement === 'blocked') {
    throw new ToolPolicyBlockedError(harness.policy.reasons);
  }
  const manifestDigest = harness.version.manifestDigest;
  if (!manifestDigest) throw new ValidationError('Harness must have an immutable manifest before it can run');
  if (harness.policy.approval.requirement === 'covered_by_user_policy') return;

  if (harness.policy.approval.requirement === 'first_use') {
    const [existing] = await db.select({ id: userToolApprovals.id }).from(userToolApprovals).where(and(
      eq(userToolApprovals.userId, userId),
      eq(userToolApprovals.productId, harness.id),
      eq(userToolApprovals.manifestDigest, manifestDigest),
      isNull(userToolApprovals.revokedAt),
    )).limit(1);
    if (existing) return;
    if (approvalManifestDigest !== manifestDigest) {
      throw new ToolApprovalError('first_use', manifestDigest, harness.policy.reasons);
    }
    await db.insert(userToolApprovals).values({
      userId,
      productId: harness.id,
      manifestDigest,
      approvalType: 'first_use',
    }).onConflictDoUpdate({
      target: [userToolApprovals.userId, userToolApprovals.productId, userToolApprovals.manifestDigest],
      set: { revokedAt: null, createdAt: new Date() },
    });
    return;
  }

  if (approvalManifestDigest !== manifestDigest) {
    throw new ToolApprovalError(
      harness.policy.approval.requirement,
      manifestDigest,
      harness.policy.reasons,
    );
  }
}

async function requestProviderHarnessStart(
  config: HarnessConfig,
  run: typeof harnessRuns.$inferSelect,
  token: string,
  input: Record<string, unknown>,
) {
  const apiOrigin = (process.env.PUBLIC_API_URL ?? process.env.MARKGIT_API_URL ?? 'https://api.markgit.com')
    .replace(/\/$/, '');
  const response = await safeFetchText(config.runtime.startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      protocol: 'markgit.harness/v1',
      run: {
        id: run.id,
        input,
        access: run.accessSnapshot,
        loop: run.loopSnapshot,
        compaction: run.compactionSnapshot,
        pricing: run.pricingSnapshot,
      },
      callbacks: {
        eventsUrl: `${apiOrigin}/v1/harness-callbacks/${run.id}/events`,
        token,
      },
    }),
    timeoutMs: 30_000,
    maxResponseBytes: 1_000_000,
    redirectPolicy: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Harness start endpoint returned ${response.status}: ${response.body.trim().slice(0, 4_096)}`);
  }
  const parsed = JSON.parse(response.body) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Harness start endpoint must return a JSON object');
  }
  return parsed;
}

function publicRun(run: typeof harnessRuns.$inferSelect, events?: Array<typeof harnessRunEvents.$inferSelect>) {
  const { callbackTokenHash: _hidden, ...visible } = run;
  const heartbeatSeconds = Number((run.loopSnapshot as { heartbeatSeconds?: number }).heartbeatSeconds ?? 60);
  const heartbeatAgeSeconds = run.lastHeartbeatAt
    ? Math.max(0, Math.floor((Date.now() - run.lastHeartbeatAt.getTime()) / 1_000))
    : null;
  const terminal = TERMINAL_STATUSES.has(run.status);
  return {
    ...visible,
    health: {
      status: terminal
        ? 'terminal' as const
        : heartbeatAgeSeconds !== null && heartbeatAgeSeconds > heartbeatSeconds * 3
          ? 'stale' as const
          : 'healthy' as const,
      expectedHeartbeatSeconds: heartbeatSeconds,
      heartbeatAgeSeconds,
    },
    monitor: {
      method: 'GET' as const,
      path: `/v1/harness-runs/${run.id}`,
      eventsPath: `/v1/harness-runs/${run.id}/events`,
      authentication: 'Bearer Markgit API key belonging to the run owner',
      vendorNeutral: true,
    },
    ...(events ? { events } : {}),
  };
}

async function ownedRun(runId: string, userId: string) {
  const [run] = await db.select().from(harnessRuns).where(eq(harnessRuns.id, runId)).limit(1);
  if (!run) throw new NotFoundError('Harness run');
  if (run.userId !== userId) throw new ForbiddenError('Harness run belongs to another account');
  return run;
}

function validateProviderEvent(run: typeof harnessRuns.$inferSelect, event: HarnessEventInput) {
  if (!EVENT_TYPES.has(event.type)) throw new ValidationError(`Unsupported harness event type: ${event.type}`);
  if (event.message !== undefined && (typeof event.message !== 'string' || event.message.length > 4_000)) {
    throw new ValidationError('Harness event message must be at most 4,000 characters');
  }
  if (event.data !== undefined && (!event.data || typeof event.data !== 'object' || Array.isArray(event.data))) {
    throw new ValidationError('Harness event data must be an object');
  }
  if (JSON.stringify(event.data ?? {}).length > 65_536) {
    throw new ValidationError('Harness event data must be at most 64 KiB');
  }
  event.data = validateHarnessEventAccess(
    run.accessSnapshot as unknown as HarnessAccessManifest,
    event.type,
    event.data ?? {},
  );
}

async function appendRunEvent(
  runId: string,
  source: 'markgit' | 'provider' | 'user',
  event: HarnessEventInput,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${runId}, 0))`);
    const [run] = await tx.select().from(harnessRuns).where(eq(harnessRuns.id, runId)).limit(1);
    if (!run) throw new NotFoundError('Harness run');
    if (TERMINAL_STATUSES.has(run.status) && !['message', 'checkpoint.created'].includes(event.type)) {
      throw new ConflictError(`Harness run is already ${run.status}`);
    }
    validateProviderEvent(run, event);
    const [latest] = await tx
      .select({ sequence: harnessRunEvents.sequence })
      .from(harnessRunEvents)
      .where(eq(harnessRunEvents.runId, runId))
      .orderBy(desc(harnessRunEvents.sequence))
      .limit(1);
    const maxSteps = Number((run.loopSnapshot as { maxSteps?: number }).maxSteps ?? 100);
    const eventLimit = Math.min(Math.max(maxSteps * 20 + 100, 200), 100_000);
    if ((latest?.sequence ?? 0) >= eventLimit) {
      throw new ValidationError(`Harness run reached its ${eventLimit} event audit limit`);
    }
    if (event.type === 'loop.step.started') {
      const [stepCount] = await tx.select({ value: sql<number>`count(*)::int` })
        .from(harnessRunEvents)
        .where(and(
          eq(harnessRunEvents.runId, runId),
          eq(harnessRunEvents.type, 'loop.step.started'),
        ));
      if (Number(stepCount?.value ?? 0) >= maxSteps) {
        throw new ValidationError(`Harness run exceeded its declared ${maxSteps}-step limit`);
      }
    }
    if (event.type === 'markgit_tool.call') {
      const access = run.accessSnapshot as unknown as HarnessAccessManifest;
      const declared = access.markgitTools.find((tool) => tool.slug === event.data?.slug);
      if (declared?.maxCallsPerRun) {
        const [callCount] = await tx.select({ value: sql<number>`count(*)::int` })
          .from(harnessRunEvents)
          .where(and(
            eq(harnessRunEvents.runId, runId),
            eq(harnessRunEvents.type, 'markgit_tool.call'),
            sql`${harnessRunEvents.data}->>'slug' = ${declared.slug}`,
          ));
        if (Number(callCount?.value ?? 0) >= declared.maxCallsPerRun) {
          throw new ValidationError(`Harness run exceeded the declared ${declared.maxCallsPerRun}-call limit for ${declared.slug}`);
        }
      }
    }
    const now = new Date();
    const [created] = await tx.insert(harnessRunEvents).values({
      runId,
      sequence: (latest?.sequence ?? 0) + 1,
      type: event.type,
      source,
      message: event.message,
      data: event.data ?? {},
    }).returning();

    const update: Partial<typeof harnessRuns.$inferInsert> = {
      updatedAt: now,
      lastHeartbeatAt: now,
    };
    if (event.type === 'run.started') {
      update.status = 'running';
      update.startedAt = run.startedAt ?? now;
    } else if (event.type === 'run.waiting') {
      update.status = 'waiting';
    } else if (event.type === 'run.completed') {
      update.status = 'completed';
      update.completedAt = now;
      update.output = (event.data?.output as Record<string, unknown> | undefined) ?? {};
    } else if (event.type === 'run.failed') {
      update.status = 'failed';
      update.completedAt = now;
      update.errorMessage = typeof event.data?.error === 'string' ? event.data.error : 'Harness run failed';
    } else if (event.type === 'compaction.completed') {
      update.compactionCount = run.compactionCount + 1;
      update.lastCompactedAt = now;
    }
    await tx.update(harnessRuns).set(update).where(eq(harnessRuns.id, runId));
    return created;
  });
}

export async function startHarnessRun(
  userId: string,
  apiKeyId: string,
  product: { id: string; slug: string; name: string },
  data: { input: Record<string, unknown> },
) {
  const [storedProduct] = await db.select({
    harnessConfig: products.harnessConfig,
    kind: products.kind,
  }).from(products).where(eq(products.id, product.id)).limit(1);
  if (!storedProduct || storedProduct.kind !== 'harness' || !storedProduct.harnessConfig) {
    throw new ValidationError('Harness does not have a runtime contract');
  }
  const config = storedProduct.harnessConfig as unknown as HarnessConfig;
  const rawCallbackToken = callbackToken();
  const [run] = await db.insert(harnessRuns).values({
    userId,
    apiKeyId,
    productId: product.id,
    status: 'starting',
    callbackTokenHash: hashApiKey(rawCallbackToken),
    input: data.input,
    accessSnapshot: config.access as unknown as Record<string, unknown>,
    pricingSnapshot: {
      markgitChargeUsd: '0.0000',
      chargedByMarkgit: false,
      externalApiCosts: config.externalApiCosts,
      note: config.pricingNote,
      externalApis: config.access.externalApis.map((api) => ({ id: api.id, name: api.name, pricing: api.pricing })),
    },
    loopSnapshot: config.loop as unknown as Record<string, unknown>,
    compactionSnapshot: config.compaction as unknown as Record<string, unknown>,
    startedAt: new Date(),
    lastHeartbeatAt: new Date(),
  }).returning();
  await appendRunEvent(run.id, 'markgit', {
    type: 'message',
    message: 'Markgit accepted this free harness run and froze its declared access and external API pricing.',
    data: { phase: 'starting' },
  });

  try {
    const response = await requestProviderHarnessStart(config, run, rawCallbackToken, data.input);
    const providerStatus = ['running', 'waiting', 'completed'].includes(String(response.status))
      ? String(response.status) as 'running' | 'waiting' | 'completed'
      : 'running';
    await db.update(harnessRuns).set({
      providerRunId: typeof response.providerRunId === 'string' ? response.providerRunId : null,
      status: providerStatus,
      output: providerStatus === 'completed'
        ? ((response.output as Record<string, unknown> | undefined) ?? {})
        : null,
      completedAt: providerStatus === 'completed' ? new Date() : null,
      updatedAt: new Date(),
    }).where(and(eq(harnessRuns.id, run.id), eq(harnessRuns.status, 'starting')));
    await appendRunEvent(run.id, 'markgit', {
      type: providerStatus === 'completed' ? 'message' : 'run.started',
      message: providerStatus === 'completed'
        ? 'Harness completed during its start request.'
        : 'Provider accepted the harness loop.',
      data: { providerRunId: response.providerRunId ?? null, providerStatus },
    }).catch((error) => {
      if (!(error instanceof ConflictError)) throw error;
    });
    return getHarnessRun(userId, run.id);
  } catch (error) {
    await db.update(harnessRuns).set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Harness start failed',
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(harnessRuns.id, run.id));
    await appendRunEvent(run.id, 'markgit', {
      type: 'message',
      message: error instanceof Error ? error.message : 'Harness start failed',
      data: { phase: 'start_failed', chargedByMarkgit: false },
    }).catch(() => undefined);
    return getHarnessRun(userId, run.id);
  }
}

export async function getHarnessRun(userId: string, runId: string) {
  const run = await ownedRun(runId, userId);
  const events = await db.select().from(harnessRunEvents)
    .where(eq(harnessRunEvents.runId, run.id))
    .orderBy(asc(harnessRunEvents.sequence));
  return publicRun(run, events);
}

export async function listHarnessRuns(userId: string, limit = 50, offset = 0) {
  const rows = await db.select().from(harnessRuns)
    .where(eq(harnessRuns.userId, userId))
    .orderBy(desc(harnessRuns.createdAt))
    .limit(limit)
    .offset(offset);
  return { runs: rows.map((run) => publicRun(run)), total: rows.length };
}

export async function listHarnessRunEvents(userId: string, runId: string, after = 0, limit = 200) {
  await ownedRun(runId, userId);
  const events = await db.select().from(harnessRunEvents)
    .where(and(eq(harnessRunEvents.runId, runId), gt(harnessRunEvents.sequence, after)))
    .orderBy(asc(harnessRunEvents.sequence))
    .limit(limit);
  return { runId, events, nextAfter: events.at(-1)?.sequence ?? after };
}

export async function ingestHarnessEvent(runId: string, token: string | undefined, event: HarnessEventInput) {
  if (!token?.startsWith('mkgt_run_')) throw new UnauthorizedError('Invalid harness callback token');
  const [run] = await db.select().from(harnessRuns).where(and(
    eq(harnessRuns.id, runId),
    eq(harnessRuns.callbackTokenHash, hashApiKey(token)),
  )).limit(1);
  if (!run) throw new UnauthorizedError('Invalid harness callback token');
  return appendRunEvent(runId, 'provider', event);
}

export async function cancelHarnessRun(userId: string, runId: string) {
  const run = await ownedRun(runId, userId);
  if (TERMINAL_STATUSES.has(run.status)) throw new ConflictError(`Harness run is already ${run.status}`);
  const [product] = await db.select({ harnessConfig: products.harnessConfig })
    .from(products).where(eq(products.id, run.productId)).limit(1);
  const config = product?.harnessConfig as unknown as HarnessConfig | null;
  if (config?.runtime.cancelUrl) {
    const response = await safeFetchText(config.runtime.cancelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        protocol: 'markgit.harness/v1',
        runId: run.id,
        providerRunId: run.providerRunId,
      }),
      maxResponseBytes: 256_000,
      redirectPolicy: 'same-origin',
    });
    if (!response.ok) throw new ValidationError(`Harness cancel endpoint returned ${response.status}`);
  }
  await db.update(harnessRuns).set({ status: 'cancelled', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(harnessRuns.id, run.id));
  await appendRunEvent(run.id, 'user', {
    type: 'message',
    message: 'The run owner cancelled this harness loop.',
    data: { phase: 'cancelled' },
  });
  return getHarnessRun(userId, run.id);
}

export async function expireOverdueHarnessRuns(limit = 100) {
  const active = await db.select().from(harnessRuns).where(inArray(harnessRuns.status, [
    'pending', 'starting', 'running', 'waiting',
  ])).orderBy(asc(harnessRuns.createdAt)).limit(limit);
  const expired: string[] = [];
  const now = Date.now();
  for (const run of active) {
    const maxRuntimeSeconds = Number((run.loopSnapshot as { maxRuntimeSeconds?: number }).maxRuntimeSeconds ?? 0);
    const start = run.startedAt?.getTime() ?? run.createdAt.getTime();
    if (!maxRuntimeSeconds || now <= start + maxRuntimeSeconds * 1_000) continue;
    try {
      await appendRunEvent(run.id, 'markgit', {
        type: 'run.failed',
        message: `Harness exceeded its declared ${maxRuntimeSeconds}-second runtime limit.`,
        data: { error: 'Declared maximum runtime exceeded', maxRuntimeSeconds },
      });
      expired.push(run.id);
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
    }
  }
  return expired;
}
