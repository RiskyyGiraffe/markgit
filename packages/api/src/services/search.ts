import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  harnessRuns,
  productSearchEmbeddings,
  productUsageReports,
  products,
  providers,
  purchases,
} from '../db/schema.js';
import { cosineSimilarity, embedQuery, ensureProductEmbeddings } from './embeddings.js';
import { reviewSummaries } from './reviews.js';

export type RegistryKind = 'tool' | 'harness' | 'mcp' | 'skill';

function stringify(value: unknown) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function buildSearchableText(item: {
  name: string;
  slug: string;
  kind: string;
  description: string | null;
  category: string | null;
  tags: string[];
  inputSchema: unknown;
  outputSchema: unknown;
  executionConfig: unknown;
  harnessConfig: unknown;
  mcpConfig: unknown;
  skillConfig: unknown;
  sourceMetadata: unknown;
  capabilities: unknown;
}) {
  return [
    item.name,
    item.slug,
    item.kind,
    item.description,
    item.category,
    item.tags.join(' '),
    stringify(item.inputSchema),
    stringify(item.outputSchema),
    stringify(item.executionConfig),
    stringify(item.harnessConfig),
    stringify(item.mcpConfig),
    stringify(item.skillConfig),
    stringify(item.sourceMetadata),
    stringify(item.capabilities),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function lexicalSearchScore(query: string, item: Parameters<typeof buildSearchableText>[0]) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return 0;
  const searchable = buildSearchableText(item);
  const terms = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  let score = searchable.includes(normalized) ? 0.45 : 0;
  if (item.name.toLowerCase().includes(normalized)) score += 0.65;
  if (item.slug.toLowerCase().includes(normalized)) score += 0.4;
  for (const term of terms) {
    if (searchable.includes(term)) score += 0.08;
    if (item.name.toLowerCase().includes(term)) score += 0.12;
  }
  return Math.min(score, 1);
}

function routeFor(kind: RegistryKind, slug: string) {
  const segment = kind === 'tool' ? 'tools' : kind === 'harness' ? 'harnesses' : `${kind}s`;
  return `/${segment}/${slug}`;
}

async function usageSummaries(productIds: string[]) {
  const empty = new Map<string, { usageCount: number; uniqueUserCount: number }>();
  if (productIds.length === 0) return empty;
  const [calls, runs, reports] = await Promise.all([
    db.select({ productId: purchases.productId, userId: purchases.userId, id: purchases.id })
      .from(purchases).where(and(inArray(purchases.productId, productIds), eq(purchases.status, 'completed'))),
    db.select({ productId: harnessRuns.productId, userId: harnessRuns.userId, id: harnessRuns.id })
      .from(harnessRuns).where(and(inArray(harnessRuns.productId, productIds), eq(harnessRuns.status, 'completed'))),
    db.select({ productId: productUsageReports.productId, userId: productUsageReports.userId, id: productUsageReports.id })
      .from(productUsageReports).where(inArray(productUsageReports.productId, productIds)),
  ]);
  const combined = [...calls, ...runs, ...reports];
  const users = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (const row of combined) {
    counts.set(row.productId, (counts.get(row.productId) ?? 0) + 1);
    const productUsers = users.get(row.productId) ?? new Set<string>();
    productUsers.add(row.userId);
    users.set(row.productId, productUsers);
  }
  return new Map(productIds.map((productId) => [productId, {
    usageCount: counts.get(productId) ?? 0,
    uniqueUserCount: users.get(productId)?.size ?? 0,
  }]));
}

export async function searchProducts(
  query = '',
  limit = 20,
  offset = 0,
  kind?: RegistryKind,
) {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const rows = await db.select({
    id: products.id,
    name: products.name,
    slug: products.slug,
    logoUrl: products.logoUrl,
    description: products.description,
    category: products.category,
    kind: products.kind,
    pricePerCallUsd: products.pricePerCallUsd,
    tags: products.tags,
    providerId: products.providerId,
    providerName: providers.name,
    providerTrustTier: providers.trustTier,
    inputSchema: products.inputSchema,
    outputSchema: products.outputSchema,
    executionConfig: products.executionConfig,
    harnessConfig: products.harnessConfig,
    mcpConfig: products.mcpConfig,
    skillConfig: products.skillConfig,
    sourceMetadata: products.sourceMetadata,
    capabilities: products.capabilities,
    manifestDigest: products.manifestDigest,
    updatedAt: products.updatedAt,
  }).from(products).innerJoin(providers, eq(products.providerId, providers.id)).where(and(
    eq(products.status, 'active'),
    kind ? eq(products.kind, kind) : undefined,
  ));

  let queryEmbedding: number[] | null = null;
  let embeddingMap = new Map<string, number[]>();
  if (normalizedQuery && rows.length > 0) {
    await ensureProductEmbeddings(rows.map((item) => item.id));
    queryEmbedding = await embedQuery(normalizedQuery);
    if (queryEmbedding) {
      const embeddings = await db.select({
        productId: productSearchEmbeddings.productId,
        embedding: productSearchEmbeddings.embedding,
      }).from(productSearchEmbeddings).where(inArray(
        productSearchEmbeddings.productId,
        rows.map((item) => item.id),
      ));
      embeddingMap = new Map(embeddings.map((row) => [row.productId, row.embedding]));
    }
  }

  const scored = rows.map((item) => {
    const lexicalScore = normalizedQuery ? lexicalSearchScore(normalizedQuery, item) : 0;
    const embedding = embeddingMap.get(item.id);
    const semanticScore = queryEmbedding && embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;
    return {
      item,
      score: normalizedQuery
        ? (queryEmbedding ? semanticScore * 0.78 + lexicalScore * 0.22 : lexicalScore)
        : 0,
      lexicalScore,
      semanticScore,
    };
  }).filter((entry) => !normalizedQuery || entry.score > 0)
    .sort((left, right) => right.score - left.score || right.item.updatedAt.getTime() - left.item.updatedAt.getTime());

  const page = scored.slice(offset, offset + limit);
  const productIds = page.map((entry) => entry.item.id);
  const [usage, reviews] = await Promise.all([usageSummaries(productIds), reviewSummaries(productIds)]);
  return {
    query: normalizedQuery,
    kind: kind ?? null,
    semantic: Boolean(queryEmbedding),
    results: page.map(({ item, score, lexicalScore, semanticScore }) => ({
      ...item,
      route: routeFor(item.kind, item.slug),
      score: Number(score.toFixed(6)),
      lexicalScore: Number(lexicalScore.toFixed(6)),
      semanticScore: Number(semanticScore.toFixed(6)),
      usage: usage.get(item.id) ?? { usageCount: 0, uniqueUserCount: 0 },
      reviews: reviews.get(item.id) ?? { helpful: 0, notHelpful: 0, total: 0, helpfulPercent: null },
    })),
    total: scored.length,
    limit,
    offset,
  };
}

export async function getUniversalRegistryItem(identifier: string) {
  const result = await searchProducts('', 10_000, 0);
  const item = result.results.find((candidate) => candidate.id === identifier || candidate.slug === identifier);
  if (!item) {
    const { NotFoundError } = await import('../lib/errors.js');
    throw new NotFoundError('Registry item');
  }
  return item;
}
