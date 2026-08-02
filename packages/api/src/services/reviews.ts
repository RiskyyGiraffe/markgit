import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  harnessRuns,
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
      eq(purchases.status, 'completed'),
    )).orderBy(desc(purchases.createdAt)).limit(1);
  if (purchase) return { type: 'markgit_purchase', id: purchase.id, verification: 'markgit_observed' } as const;

  const [run] = await db.select({ id: harnessRuns.id, createdAt: harnessRuns.createdAt })
    .from(harnessRuns)
    .where(and(
      eq(harnessRuns.userId, userId),
      eq(harnessRuns.productId, productId),
      eq(harnessRuns.status, 'completed'),
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
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    },
    verification: evidence.verification,
  };
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
