import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  harnessRuns,
  productFeedbackEvents,
  productReviews,
  products,
  productUsageReports,
  purchases,
} from '../db/schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveProduct(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier)
    ? eq(products.id, identifier)
    : eq(products.slug, identifier);
  const [product] = await db.select().from(products).where(and(
    identifierFilter,
    eq(products.status, 'active'),
  )).limit(1);
  if (!product) throw new NotFoundError('Registry item');
  return product;
}

export async function getPublicReviews(identifier: string, limit = 20, offset = 0) {
  const product = await resolveProduct(identifier);
  const [counts] = await db.select({
    helpful: sql<number>`count(*) filter (where ${productReviews.helpful} = true)::int`,
    notHelpful: sql<number>`count(*) filter (where ${productReviews.helpful} = false)::int`,
    total: sql<number>`count(*)::int`,
  }).from(productReviews).where(and(
    eq(productReviews.productId, product.id),
    eq(productReviews.status, 'published'),
  ));

  const reviews = await db.select({
    id: productReviews.id,
    helpful: productReviews.helpful,
    title: productReviews.title,
    body: productReviews.body,
    agentName: productReviews.agentName,
    evidenceType: productReviews.evidenceType,
    manifestDigest: productReviews.manifestDigest,
    feedbackContextId: productReviews.feedbackContextId,
    feedbackEventCount: productReviews.feedbackEventCount,
    consolidatedAt: productReviews.consolidatedAt,
    createdAt: productReviews.createdAt,
    updatedAt: productReviews.updatedAt,
  }).from(productReviews).where(and(
    eq(productReviews.productId, product.id),
    eq(productReviews.status, 'published'),
  )).orderBy(desc(productReviews.updatedAt)).limit(limit).offset(offset);

  const helpful = Number(counts?.helpful ?? 0);
  const notHelpful = Number(counts?.notHelpful ?? 0);
  const total = Number(counts?.total ?? 0);
  return {
    product: { id: product.id, slug: product.slug, name: product.name, kind: product.kind },
    summary: {
      helpful,
      notHelpful,
      total,
      helpfulPercent: total > 0 ? Math.round((helpful / total) * 100) : null,
    },
    reviews: reviews.map((review) => ({
      ...review,
      verification: review.evidenceType === 'agent_attested' ? 'agent_attested' : 'markgit_observed',
      consolidation: review.consolidatedAt ? {
        contextId: review.feedbackContextId,
        feedbackEventCount: review.feedbackEventCount,
        consolidatedAt: review.consolidatedAt,
        provenance: 'authenticated_agent_relay' as const,
      } : null,
    })),
  };
}

export async function reportProductUsage(input: {
  userId: string;
  apiKeyId: string;
  identifier: string;
  interactionId: string;
  agentName: string;
  evidenceSummary?: string;
}) {
  const product = await resolveProduct(input.identifier);
  const interactionId = input.interactionId.trim();
  const agentName = input.agentName.trim();
  if (!interactionId || interactionId.length > 255) throw new ValidationError('interactionId must be 1-255 characters');
  if (!agentName || agentName.length > 100) throw new ValidationError('agentName must be 1-100 characters');
  if ((input.evidenceSummary?.length ?? 0) > 1000) throw new ValidationError('evidenceSummary cannot exceed 1000 characters');

  const [report] = await db.insert(productUsageReports).values({
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    productId: product.id,
    interactionId,
    agentName,
    evidenceSummary: input.evidenceSummary?.trim() || null,
  }).onConflictDoUpdate({
    target: [productUsageReports.userId, productUsageReports.productId, productUsageReports.interactionId],
    set: {
      apiKeyId: input.apiKeyId,
      agentName,
      evidenceSummary: input.evidenceSummary?.trim() || null,
    },
  }).returning();

  return { report, product: { id: product.id, slug: product.slug, kind: product.kind } };
}

async function findReviewEvidence(userId: string, productId: string) {
  const [purchase] = await db.select({ id: purchases.id, createdAt: purchases.createdAt })
    .from(purchases)
    .where(and(
      eq(purchases.userId, userId),
      eq(purchases.productId, productId),
      inArray(purchases.status, ['completed', 'failed']),
    )).orderBy(desc(purchases.createdAt)).limit(1);
  if (purchase) return { type: 'markgit_purchase', id: purchase.id, verification: 'markgit_observed' } as const;

  const [run] = await db.select({ id: harnessRuns.id, createdAt: harnessRuns.createdAt })
    .from(harnessRuns)
    .where(and(
      eq(harnessRuns.userId, userId),
      eq(harnessRuns.productId, productId),
      inArray(harnessRuns.status, ['completed', 'failed', 'cancelled']),
    )).orderBy(desc(harnessRuns.createdAt)).limit(1);
  if (run) return { type: 'markgit_loop', id: run.id, verification: 'markgit_observed' } as const;

  const [report] = await db.select({ id: productUsageReports.id, createdAt: productUsageReports.createdAt })
    .from(productUsageReports)
    .where(and(
      eq(productUsageReports.userId, userId),
      eq(productUsageReports.productId, productId),
    )).orderBy(desc(productUsageReports.createdAt)).limit(1);
  if (report) return { type: 'agent_attested', id: report.id, verification: 'agent_attested' } as const;
  return null;
}

export async function getReviewEligibility(userId: string, identifier: string) {
  const product = await resolveProduct(identifier);
  const evidence = await findReviewEvidence(userId, product.id);
  const [review] = await db.select({
    id: productReviews.id,
    helpful: productReviews.helpful,
    title: productReviews.title,
    body: productReviews.body,
    agentName: productReviews.agentName,
    evidenceType: productReviews.evidenceType,
    manifestDigest: productReviews.manifestDigest,
    status: productReviews.status,
    createdAt: productReviews.createdAt,
    updatedAt: productReviews.updatedAt,
  }).from(productReviews).where(and(
    eq(productReviews.userId, userId),
    eq(productReviews.productId, product.id),
  )).limit(1);
  return {
    product: { id: product.id, slug: product.slug, name: product.name, kind: product.kind },
    eligible: Boolean(evidence),
    evidence,
    review: review ?? null,
  };
}

export async function upsertProductReview(input: {
  userId: string;
  apiKeyId: string;
  identifier: string;
  helpful: boolean;
  title?: string;
  body?: string;
  agentName: string;
  feedbackConsolidation?: { contextId: string; eventCount: number; consolidatedAt: Date };
}) {
  const product = await resolveProduct(input.identifier);
  const agentName = input.agentName.trim();
  const title = input.title?.trim() || null;
  const body = input.body?.trim() || null;
  if (!agentName || agentName.length > 100) throw new ValidationError('agentName must be 1-100 characters');
  if ((title?.length ?? 0) > 160) throw new ValidationError('title cannot exceed 160 characters');
  if ((body?.length ?? 0) > 4000) throw new ValidationError('body cannot exceed 4000 characters');
  const evidence = await findReviewEvidence(input.userId, product.id);
  if (!evidence) {
    throw new ValidationError('You must use this item before reviewing it. Markgit-observed calls and runs qualify; direct MCP and skill use can be reported first.');
  }

  const [review] = await db.insert(productReviews).values({
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    productId: product.id,
    helpful: input.helpful,
    title,
    body,
    agentName,
    evidenceType: evidence.type,
    evidenceId: evidence.id,
    manifestDigest: product.manifestDigest,
    feedbackContextId: input.feedbackConsolidation?.contextId ?? null,
    feedbackEventCount: input.feedbackConsolidation?.eventCount ?? 0,
    consolidatedAt: input.feedbackConsolidation?.consolidatedAt ?? null,
    status: 'published',
  }).onConflictDoUpdate({
    target: [productReviews.userId, productReviews.productId],
    set: {
      apiKeyId: input.apiKeyId,
      helpful: input.helpful,
      title,
      body,
      agentName,
      evidenceType: evidence.type,
      evidenceId: evidence.id,
      manifestDigest: product.manifestDigest,
      feedbackContextId: input.feedbackConsolidation?.contextId ?? null,
      feedbackEventCount: input.feedbackConsolidation?.eventCount ?? 0,
      consolidatedAt: input.feedbackConsolidation?.consolidatedAt ?? null,
      status: 'published',
      updatedAt: new Date(),
    },
  }).returning();
  return {
    review: {
      id: review.id,
      helpful: review.helpful,
      title: review.title,
      body: review.body,
      agentName: review.agentName,
      evidenceType: review.evidenceType,
      manifestDigest: review.manifestDigest,
      feedbackContextId: review.feedbackContextId,
      feedbackEventCount: review.feedbackEventCount,
      consolidatedAt: review.consolidatedAt,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    },
    verification: evidence.verification,
  };
}

const FEEDBACK_SENTIMENTS = new Set(['positive', 'negative', 'neutral']);

export function consolidateFeedbackText(
  events: Array<{ sentiment: string; message: string }>,
  input: { finalHelpful?: boolean; title?: string; finalSummary?: string },
) {
  if (events.length === 0) throw new ValidationError('No feedback has been recorded for this context');
  const score = events.reduce((total, event) => total + (event.sentiment === 'positive' ? 1 : event.sentiment === 'negative' ? -1 : 0), 0);
  if (score === 0 && input.finalHelpful === undefined) {
    throw new ValidationError('Mixed or neutral feedback requires finalHelpful to reflect the user outcome');
  }
  const helpful = input.finalHelpful ?? (score > 0);
  const title = input.title?.trim() || (score > 0
    ? 'Helped the user over this task'
    : score < 0
      ? 'Did not meet the user’s needs'
      : helpful ? 'Ultimately helped the user' : 'Ultimately did not help the user');
  const feedbackLines = events.slice(-12).map((event) => `- ${event.sentiment}: ${event.message}`);
  const finalSummary = input.finalSummary?.replace(/\s+/g, ' ').trim();
  if ((finalSummary?.length ?? 0) > 2_000) throw new ValidationError('finalSummary cannot exceed 2000 characters');
  const body = [
    finalSummary,
    `Consolidated from ${events.length} user feedback signal${events.length === 1 ? '' : 's'} over this task:`,
    ...feedbackLines,
  ].filter(Boolean).join('\n\n').slice(0, 4_000);
  return { helpful, title, body, score };
}

export async function recordProductFeedback(input: {
  userId: string;
  apiKeyId: string;
  identifier: string;
  contextId: string;
  clientEventId: string;
  sentiment: string;
  message: string;
  harnessRunId?: string;
}) {
  const product = await resolveProduct(input.identifier);
  const contextId = input.contextId.trim();
  const clientEventId = input.clientEventId.trim();
  const message = input.message.replace(/\s+/g, ' ').trim();
  if (!contextId || contextId.length > 255) throw new ValidationError('contextId must be 1-255 characters');
  if (!clientEventId || clientEventId.length > 255) throw new ValidationError('clientEventId must be 1-255 characters');
  if (!FEEDBACK_SENTIMENTS.has(input.sentiment)) throw new ValidationError('sentiment must be positive, negative, or neutral');
  if (!message || message.length > 1_000) throw new ValidationError('message must be 1-1000 characters');
  if (input.harnessRunId) {
    const [run] = await db.select({ id: harnessRuns.id }).from(harnessRuns).where(and(
      eq(harnessRuns.id, input.harnessRunId),
      eq(harnessRuns.userId, input.userId),
      eq(harnessRuns.productId, product.id),
    )).limit(1);
    if (!run) throw new ValidationError('harnessRunId must belong to this account and listing');
  }
  const [existing, count] = await Promise.all([
    db.select({ id: productFeedbackEvents.id }).from(productFeedbackEvents).where(and(
      eq(productFeedbackEvents.userId, input.userId),
      eq(productFeedbackEvents.productId, product.id),
      eq(productFeedbackEvents.contextId, contextId),
      eq(productFeedbackEvents.clientEventId, clientEventId),
    )).limit(1),
    db.select({ value: sql<number>`count(*)::int` }).from(productFeedbackEvents).where(and(
      eq(productFeedbackEvents.userId, input.userId),
      eq(productFeedbackEvents.productId, product.id),
      eq(productFeedbackEvents.contextId, contextId),
    )),
  ]);
  if (!existing.length && Number(count[0]?.value ?? 0) >= 100) {
    throw new ValidationError('A feedback context can contain at most 100 events');
  }
  const [event] = await db.insert(productFeedbackEvents).values({
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    productId: product.id,
    harnessRunId: input.harnessRunId ?? null,
    contextId,
    clientEventId,
    sentiment: input.sentiment,
    message,
  }).onConflictDoUpdate({
    target: [
      productFeedbackEvents.userId,
      productFeedbackEvents.productId,
      productFeedbackEvents.contextId,
      productFeedbackEvents.clientEventId,
    ],
    set: { sentiment: input.sentiment, message, apiKeyId: input.apiKeyId },
  }).returning();
  return {
    event: {
      id: event.id,
      contextId: event.contextId,
      clientEventId: event.clientEventId,
      sentiment: event.sentiment,
      message: event.message,
      createdAt: event.createdAt,
    },
    privacy: 'This feedback is private until an authenticated agent consolidates the context into one public review.',
  };
}

export async function consolidateProductFeedback(input: {
  userId: string;
  apiKeyId: string;
  identifier: string;
  contextId: string;
  agentName: string;
  harnessRunId?: string;
  finalHelpful?: boolean;
  title?: string;
  finalSummary?: string;
}) {
  const product = await resolveProduct(input.identifier);
  const contextId = input.contextId.trim();
  if (!contextId || contextId.length > 255) throw new ValidationError('contextId must be 1-255 characters');
  if (input.harnessRunId) {
    const [run] = await db.select({ status: harnessRuns.status }).from(harnessRuns).where(and(
      eq(harnessRuns.id, input.harnessRunId),
      eq(harnessRuns.userId, input.userId),
      eq(harnessRuns.productId, product.id),
    )).limit(1);
    if (!run) throw new ValidationError('harnessRunId must belong to this account and listing');
    if (!['completed', 'failed', 'cancelled'].includes(run.status)) {
      throw new ValidationError('Run feedback can only be consolidated after the run reaches a terminal state');
    }
  }
  const events = await db.select().from(productFeedbackEvents).where(and(
    eq(productFeedbackEvents.userId, input.userId),
    eq(productFeedbackEvents.productId, product.id),
    eq(productFeedbackEvents.contextId, contextId),
  )).orderBy(asc(productFeedbackEvents.createdAt));
  const consolidated = consolidateFeedbackText(events, {
    finalHelpful: input.finalHelpful,
    title: input.title,
    finalSummary: input.finalSummary,
  });
  return upsertProductReview({
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    identifier: product.id,
    helpful: consolidated.helpful,
    title: consolidated.title,
    body: consolidated.body,
    agentName: input.agentName,
    feedbackConsolidation: { contextId, eventCount: events.length, consolidatedAt: new Date() },
  });
}

export async function recordHarnessRunFeedback(input: {
  userId: string;
  apiKeyId: string;
  runId: string;
  clientEventId: string;
  sentiment: string;
  message: string;
}) {
  const [run] = await db.select({ productId: harnessRuns.productId }).from(harnessRuns).where(and(
    eq(harnessRuns.id, input.runId),
    eq(harnessRuns.userId, input.userId),
  )).limit(1);
  if (!run) throw new NotFoundError('Harness run');
  return recordProductFeedback({
    ...input,
    identifier: run.productId,
    contextId: input.runId,
    harnessRunId: input.runId,
  });
}

export async function consolidateHarnessRunFeedback(input: {
  userId: string;
  apiKeyId: string;
  runId: string;
  agentName: string;
  finalHelpful?: boolean;
  title?: string;
  finalSummary?: string;
}) {
  const [run] = await db.select({ productId: harnessRuns.productId }).from(harnessRuns).where(and(
    eq(harnessRuns.id, input.runId),
    eq(harnessRuns.userId, input.userId),
  )).limit(1);
  if (!run) throw new NotFoundError('Harness run');
  return consolidateProductFeedback({
    ...input,
    identifier: run.productId,
    contextId: input.runId,
    harnessRunId: input.runId,
  });
}

export async function autoConsolidateHarnessRunFeedback(runId: string) {
  const [run] = await db.select({ userId: harnessRuns.userId, apiKeyId: harnessRuns.apiKeyId })
    .from(harnessRuns).where(eq(harnessRuns.id, runId)).limit(1);
  if (!run) return null;
  try {
    return await consolidateHarnessRunFeedback({
      userId: run.userId,
      apiKeyId: run.apiKeyId,
      runId,
      agentName: 'markgit-run-feedback',
    });
  } catch (error) {
    // No feedback or a mixed outcome remains private until the agent supplies
    // the final user outcome explicitly.
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

export async function deleteProductReview(userId: string, identifier: string) {
  const product = await resolveProduct(identifier);
  const [review] = await db.delete(productReviews).where(and(
    eq(productReviews.userId, userId),
    eq(productReviews.productId, product.id),
  )).returning({ id: productReviews.id });
  return { deleted: Boolean(review) };
}

export async function reviewSummaries(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, { helpful: number; notHelpful: number; total: number; helpfulPercent: number | null }>();
  const rows = await db.select({
    productId: productReviews.productId,
    helpful: sql<number>`count(*) filter (where ${productReviews.helpful} = true)::int`,
    notHelpful: sql<number>`count(*) filter (where ${productReviews.helpful} = false)::int`,
    total: sql<number>`count(*)::int`,
  }).from(productReviews).where(and(
    or(...productIds.map((id) => eq(productReviews.productId, id))),
    eq(productReviews.status, 'published'),
  )).groupBy(productReviews.productId);
  return new Map(rows.map((row) => {
    const helpful = Number(row.helpful);
    const total = Number(row.total);
    return [row.productId, {
      helpful,
      notHelpful: Number(row.notHelpful),
      total,
      helpfulPercent: total > 0 ? Math.round((helpful / total) * 100) : null,
    }];
  }));
}
