import { sql, eq, and, ilike, or, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';

function buildSearchDocument() {
  return sql`
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
}

async function expandSemanticQuery(query: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            'Expand this marketplace search query into up to 6 short related search phrases.',
            'Focus on product intent, synonyms, input/output concepts, and common buyer vocabulary.',
            'Return JSON only in the form {"terms":["..."]}.',
            `Query: ${query}`,
          ].join('\n'),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as { terms?: unknown[] };
    return (parsed.terms ?? [])
      .filter((term): term is string => typeof term === 'string')
      .map((term) => term.trim())
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

async function runSearchQuery(query: string, limit: number, offset: number) {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const likeQuery = `%${normalizedQuery}%`;
  const searchDocument = buildSearchDocument();
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

  return results.map(({ relevance: _relevance, ...product }) => product);
}

export async function searchProducts(query: string, limit = 20, offset = 0) {
  const primaryResults = await runSearchQuery(query, limit, offset);
  if (primaryResults.length >= Math.min(limit, 3)) {
    return { results: primaryResults, total: primaryResults.length };
  }

  const relatedTerms = await expandSemanticQuery(query);
  if (relatedTerms.length === 0) {
    return { results: primaryResults, total: primaryResults.length };
  }

  const expandedQuery = [query, ...relatedTerms].join(' OR ');
  const expandedResults = await runSearchQuery(expandedQuery, limit, offset);
  const deduped = [...primaryResults];

  for (const result of expandedResults) {
    if (!deduped.some((existing) => existing.id === result.id)) {
      deduped.push(result);
    }
    if (deduped.length >= limit) break;
  }

  return { results: deduped, total: deduped.length };
}
