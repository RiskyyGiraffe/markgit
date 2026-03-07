import { sql, eq, and, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';

export async function searchProducts(query: string, limit = 20, offset = 0) {
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
    .where(
      and(
        eq(products.status, 'active'),
        or(
          ilike(products.name, `%${query}%`),
          ilike(products.description, `%${query}%`),
          ilike(products.category, `%${query}%`),
        ),
      ),
    )
    .limit(limit)
    .offset(offset);

  return { results, total: results.length };
}
