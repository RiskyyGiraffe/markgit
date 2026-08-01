import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, purchases } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import { normalizeOptionalLogoUrl } from '../lib/public-asset-url.js';
import { ensureProductEmbeddings } from './embeddings.js';
import { normalizeToolCapabilities, type ToolCapabilities } from '../lib/tool-policy.js';
import { ensureProductVersion } from './product-versions.js';

export async function listProducts(limit = 50, offset = 0) {
  const results = await db
    .select({
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
      usageCount: sql<number>`count(${purchases.id})::int`,
      uniqueUserCount: sql<number>`count(distinct ${purchases.userId})::int`,
    })
    .from(products)
    .leftJoin(purchases, and(eq(purchases.productId, products.id), eq(purchases.status, 'completed')))
    .where(and(eq(products.status, 'active'), eq(products.kind, 'tool')))
    .groupBy(products.id)
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);

  return { results, total: results.length };
}

export async function getProduct(id: string) {
  const [product] = await db
    .select({
      id: products.id,
      providerId: products.providerId,
      name: products.name,
      slug: products.slug,
      logoUrl: products.logoUrl,
      description: products.description,
      category: products.category,
      kind: products.kind,
      status: products.status,
      moderationStatus: products.moderationStatus,
      inputSchema: products.inputSchema,
      outputSchema: products.outputSchema,
      executionConfig: products.executionConfig,
      harnessConfig: products.harnessConfig,
      mcpConfig: products.mcpConfig,
      skillConfig: products.skillConfig,
      capabilities: products.capabilities,
      manifestDigest: products.manifestDigest,
      currentVersion: products.currentVersion,
      pricePerCallUsd: products.pricePerCallUsd,
      tags: products.tags,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      usageCount: sql<number>`count(${purchases.id})::int`,
      uniqueUserCount: sql<number>`count(distinct ${purchases.userId})::int`,
    })
    .from(products)
    .leftJoin(purchases, and(eq(purchases.productId, products.id), eq(purchases.status, 'completed')))
    .where(eq(products.id, id))
    .groupBy(products.id)
    .limit(1);

  if (!product) throw new NotFoundError('Product');
  return product;
}

export async function getProductBySlug(slug: string) {
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return product ?? null;
}

export async function listProviderProducts(providerId: string, limit = 50, offset = 0) {
  const results = await db
    .select()
    .from(products)
    .where(eq(products.providerId, providerId))
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);

  return { results, total: results.length };
}

export async function createProduct(data: {
  providerId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  category?: string;
  kind?: 'tool' | 'harness' | 'mcp' | 'skill';
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  executionConfig?: Record<string, unknown>;
  harnessConfig?: Record<string, unknown>;
  mcpConfig?: Record<string, unknown>;
  skillConfig?: Record<string, unknown>;
  capabilities?: Partial<Omit<ToolCapabilities, 'declared'>>;
  pricePerCallUsd: string;
  tags?: string[];
  status?: typeof products.$inferInsert.status;
}) {
  const logoUrl = normalizeOptionalLogoUrl(data.logoUrl);
  const capabilities = normalizeToolCapabilities(data.capabilities, data.executionConfig);
  const [product] = await db
    .insert(products)
    .values({
      ...data,
      logoUrl,
      capabilities,
      tags: data.tags ?? [],
    })
    .returning();

  const version = await ensureProductVersion(product.id);
  if (product.status === 'active') {
    await ensureProductEmbeddings([product.id]);
  }

  return {
    ...product,
    capabilities,
    manifestDigest: version.manifestDigest,
    currentVersion: version.version,
  };
}

export async function updateProductStatus(id: string, status: typeof products.$inferInsert.status) {
  const [product] = await db
    .update(products)
    .set({ status, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  if (!product) throw new NotFoundError('Product');
  if (product.status === 'active') {
    const version = await ensureProductVersion(product.id);
    await ensureProductEmbeddings([product.id]);
    return {
      ...product,
      manifestDigest: version.manifestDigest,
      currentVersion: version.version,
    };
  }
  return product;
}
