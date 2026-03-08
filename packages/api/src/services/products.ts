import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

export async function listProducts(limit = 50, offset = 0) {
  const results = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      category: products.category,
      pricePerCallUsd: products.pricePerCallUsd,
      tags: products.tags,
      providerId: products.providerId,
    })
    .from(products)
    .where(eq(products.status, 'active'))
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);

  return { results, total: results.length };
}

export async function getProduct(id: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) throw new NotFoundError('Product');
  return product;
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
  description?: string;
  category?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  executionConfig?: Record<string, unknown>;
  pricePerCallUsd: string;
  tags?: string[];
}) {
  const [product] = await db
    .insert(products)
    .values({
      ...data,
      tags: data.tags ?? [],
    })
    .returning();

  return product;
}

export async function updateProductStatus(id: string, status: typeof products.$inferInsert.status) {
  const [product] = await db
    .update(products)
    .set({ status, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  if (!product) throw new NotFoundError('Product');
  return product;
}
