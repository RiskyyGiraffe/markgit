import { and, asc, eq, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { backgroundJobs } from '../db/schema.js';
import { createPayout, enqueueEligiblePayouts } from './stripe-connect.js';

const WORKER_ID = `${process.env.HOSTNAME ?? 'markgit-api'}:${process.pid}`;

type BackgroundJobKind = 'payout_provider' | 'payout_sweep';

type PayoutProviderPayload = {
  providerId: string;
};

type PayoutSweepPayload = Record<string, never>;

type JobPayload = PayoutProviderPayload | PayoutSweepPayload;

function getRetryDelayMs(attempts: number) {
  const boundedAttempts = Math.min(Math.max(attempts, 1), 6);
  return Math.pow(2, boundedAttempts - 1) * 15 * 60 * 1000;
}

export async function scheduleJob(
  kind: BackgroundJobKind,
  payload: JobPayload,
  runAt = new Date(),
  maxAttempts = 5,
) {
  const [job] = await db
    .insert(backgroundJobs)
    .values({
      kind,
      payload,
      runAt,
      maxAttempts,
    })
    .returning();

  return job;
}

export async function schedulePayoutForProvider(providerId: string, runAt = new Date()) {
  const existing = await db
    .select({ id: backgroundJobs.id, payload: backgroundJobs.payload })
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.kind, 'payout_provider'),
        eq(backgroundJobs.status, 'pending'),
      ),
    );

  const duplicate = existing.find((job) => {
    const payload = job.payload as { providerId?: string } | undefined;
    return payload?.providerId === providerId;
  });

  if (duplicate) return duplicate;

  return scheduleJob('payout_provider', { providerId }, runAt, 8);
}

export async function schedulePayoutSweep(runAt = new Date()) {
  const [existing] = await db
    .select({ id: backgroundJobs.id })
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.kind, 'payout_sweep'),
        eq(backgroundJobs.status, 'pending'),
      ),
    )
    .limit(1);

  if (existing) return existing;
  return scheduleJob('payout_sweep', {}, runAt, 1000);
}

async function claimNextJob() {
  const [candidate] = await db
    .select()
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.status, 'pending'),
        lte(backgroundJobs.runAt, new Date()),
      ),
    )
    .orderBy(asc(backgroundJobs.runAt), asc(backgroundJobs.createdAt))
    .limit(1);

  if (!candidate) return null;

  const [claimed] = await db
    .update(backgroundJobs)
    .set({
      status: 'running',
      lockedAt: new Date(),
      lockedBy: WORKER_ID,
      attempts: candidate.attempts + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(backgroundJobs.id, candidate.id),
        eq(backgroundJobs.status, 'pending'),
      ),
    )
    .returning();

  return claimed ?? null;
}

async function completeJob(jobId: string) {
  await db
    .update(backgroundJobs)
    .set({
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(backgroundJobs.id, jobId));
}

async function failJob(jobId: string, attempts: number, maxAttempts: number, message: string, retryable = true) {
  const shouldRetry = retryable && attempts < maxAttempts;
  await db
    .update(backgroundJobs)
    .set({
      status: shouldRetry ? 'pending' : 'failed',
      runAt: shouldRetry ? new Date(Date.now() + getRetryDelayMs(attempts)) : undefined,
      lockedAt: null,
      lockedBy: null,
      lastError: message,
      updatedAt: new Date(),
    })
    .where(eq(backgroundJobs.id, jobId));
}

function isRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('balance_insufficient') || message.includes('temporarily unavailable');
}

async function processJob(job: typeof backgroundJobs.$inferSelect) {
  if (job.kind === 'payout_sweep') {
    await enqueueEligiblePayouts();
    await schedulePayoutSweep(new Date(Date.now() + 24 * 60 * 60 * 1000));
    return;
  }

  if (job.kind === 'payout_provider') {
    const payload = job.payload as PayoutProviderPayload;
    if (!payload.providerId) {
      throw new Error('Payout job missing providerId');
    }
    await createPayout(payload.providerId);
    return;
  }

  throw new Error(`Unsupported job kind: ${job.kind}`);
}

export async function runDueJobs(maxJobs = 10) {
  const processed: Array<{ id: string; kind: string; status: string }> = [];

  for (let index = 0; index < maxJobs; index += 1) {
    const job = await claimNextJob();
    if (!job) break;

    try {
      await processJob(job);
      await completeJob(job.id);
      processed.push({ id: job.id, kind: job.kind, status: 'completed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(job.id, job.attempts, job.maxAttempts, message, isRetryableError(error));
      processed.push({ id: job.id, kind: job.kind, status: 'failed' });
    }
  }

  return processed;
}
