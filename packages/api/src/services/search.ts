import { sql, eq, and, ilike, or, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';

export async function searchProducts(query: string, limit = 20, offset = 0) {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const likeQuery = `%${normalizedQuery}%`;
  const searchDocument = sql`
    (
      setweight(to_tsvector('english', coalesce(${products.name}, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${products.description}, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(${products.category}, '')), 'C') ||
      setweight(to_tsvector('english', coalesce(${products.tags}::text, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(${products.inputSchema}::text, '')), 'D') ||
      setweight(to_tsvector('english', coalesce(${products.outputSchema}::text, '')), 'D') ||
      setweight(to_tsvector('english', coalesce(${products.executionConfig}::text, '')), 'D')
    )
  `;
  const tsQuery = sql`websearch_to_tsquery('english', ${normalizedQuery})`;
  const relevance = sql<number>`
    ts_rank_cd(${searchDocument}, ${tsQuery}) +
    CASE WHEN ${products.name} ILIKE ${likeQuery} THEN 1.0 ELSE 0 END +
    CASE WHEN ${products.description} ILIKE ${likeQuery} THEN 0.45 ELSE 0 END +
    CASE WHEN ${products.tags}::text ILIKE ${likeQuery} THEN 0.35 ELSE 0 END +
    CASE WHEN ${products.inputSchema}::text ILIKE ${likeQuery} THEN 0.15 ELSE 0 END +
    CASE WHEN ${products.outputSchema}::text ILIKE ${likeQuery} THEN 0.15 ELSE 0 END +
    CASE WHEN ${products.executionConfig}::text ILIKE ${likeQuery} THEN 0.1 ELSE 0 END
  `;

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
      relevance,
    })
    .from(products)
    .where(
      and(
        eq(products.status, 'active'),
        or(
          sql`${searchDocument} @@ ${tsQuery}`,
          ilike(products.name, likeQuery),
          ilike(products.description, likeQuery),
          ilike(products.category, likeQuery),
          sql`${products.tags}::text ILIKE ${likeQuery}`,
          sql`${products.inputSchema}::text ILIKE ${likeQuery}`,
          sql`${products.outputSchema}::text ILIKE ${likeQuery}`,
          sql`${products.executionConfig}::text ILIKE ${likeQuery}`,
        ),
      ),
    )
    .orderBy(desc(relevance), products.name)
    .limit(limit)
    .offset(offset);

  return {
    results: results.map(({ relevance: _relevance, ...product }) => product),
    total: results.length,
  };
}
