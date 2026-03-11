import { sql, eq, and, ilike, or, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, productSearchEmbeddings } from '../db/schema.js';
import { cosineSimilarity, embedQuery, ensureProductEmbeddings } from './embeddings.js';

const semanticLexicon: Record<string, string[]> = {
  birthday: ['age', 'years', 'estimate'],
  guess: ['estimate', 'prediction'],
  years: ['age'],
  first: ['name'],
  firstname: ['name'],
  demographic: ['demographics', 'population'],
  predictor: ['prediction', 'estimate'],
  weather: ['forecast', 'temperature', 'climate'],
  dogs: ['dog'],
  facts: ['fact'],
};

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
  const lexicalTerms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .flatMap((term) => semanticLexicon[term] ?? []);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Array.from(new Set(lexicalTerms)).slice(0, 6);

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

  if (!response.ok) return Array.from(new Set(lexicalTerms)).slice(0, 6);

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return Array.from(new Set(lexicalTerms)).slice(0, 6);

  try {
    const parsed = JSON.parse(content) as { terms?: unknown[] };
    const parsedTerms = (parsed.terms ?? [])
      .filter((term): term is string => typeof term === 'string')
      .map((term) => term.trim())
      .filter(Boolean);

    return Array.from(
      new Set([
        ...lexicalTerms,
        ...parsedTerms,
      ]),
    ).slice(0, 6);
  } catch {
    return Array.from(new Set(lexicalTerms)).slice(0, 6);
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
  const primaryResults = await runSearchQuery(query, limit * 2, 0);
  const relatedTerms = primaryResults.length >= Math.min(limit, 3) ? [] : await expandSemanticQuery(query);
  const expandedQuery = relatedTerms.length > 0 ? [query, ...relatedTerms].join(' OR ') : query;
  const expandedResults =
    relatedTerms.length > 0 ? await runSearchQuery(expandedQuery, limit * 2, 0) : primaryResults;

  const combined = [...primaryResults];
  for (const result of expandedResults) {
    if (!combined.some((existing) => existing.id === result.id)) {
      combined.push(result);
    }
  }

  await ensureProductEmbeddings(combined.map((item) => item.id));
  const queryEmbedding = await embedQuery(query);
  if (!queryEmbedding) {
    return {
      results: combined.slice(offset, offset + limit),
      total: combined.length,
    };
  }

  const embeddings = await db
    .select()
    .from(productSearchEmbeddings)
    .where(inArray(productSearchEmbeddings.productId, combined.map((item) => item.id)));
  const embeddingMap = new Map(embeddings.map((row) => [row.productId, row.embedding]));

  const scored = combined
    .map((item, index) => {
      const embedding = embeddingMap.get(item.id);
      const semanticScore = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;
      const lexicalBonus = Math.max(0, (combined.length - index) / combined.length);
      return {
        item,
        score: semanticScore * 0.75 + lexicalBonus * 0.25,
      };
    })
    .sort((left, right) => right.score - left.score);

  return {
    results: scored.slice(offset, offset + limit).map((entry) => entry.item),
    total: scored.length,
  };
}
