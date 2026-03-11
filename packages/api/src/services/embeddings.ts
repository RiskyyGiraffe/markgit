import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, productSearchEmbeddings } from '../db/schema.js';
import { sha256 } from '../lib/hash.js';

const DEFAULT_EMBED_MODEL = process.env.OPENROUTER_EMBED_MODEL ?? 'openai/text-embedding-3-small';

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
};

function normalizeText(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function buildProductEmbeddingText(product: {
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
}) {
  return [
    `name: ${product.name}`,
    `description: ${normalizeText(product.description)}`,
    `category: ${normalizeText(product.category)}`,
    `tags: ${product.tags.join(', ')}`,
    `inputs: ${normalizeText(product.inputSchema)}`,
    `outputs: ${normalizeText(product.outputSchema)}`,
    `execution: ${normalizeText(product.executionConfig)}`,
  ].join('\n');
}

async function requestEmbeddings(input: string[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_EMBED_MODEL,
      input,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as EmbeddingResponse;
  const embeddings = (body.data ?? [])
    .map((item) => item.embedding)
    .filter((embedding): embedding is number[] => Array.isArray(embedding));

  return embeddings.length === input.length ? embeddings : null;
}

export async function ensureProductEmbeddings(productIds?: string[]) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      tags: products.tags,
      inputSchema: products.inputSchema,
      outputSchema: products.outputSchema,
      executionConfig: products.executionConfig,
    })
    .from(products)
    .where(
      productIds?.length
        ? inArray(products.id, productIds)
        : eq(products.status, 'active'),
    );

  if (rows.length === 0) return [];

  const existing = await db
    .select()
    .from(productSearchEmbeddings)
    .where(inArray(productSearchEmbeddings.productId, rows.map((row) => row.id)));

  const existingMap = new Map(existing.map((row) => [row.productId, row]));
  const pending = rows
    .map((row) => {
      const sourceText = buildProductEmbeddingText(row);
      const contentHash = sha256(sourceText);
      const current = existingMap.get(row.id);
      return {
        row,
        sourceText,
        contentHash,
        current,
      };
    })
    .filter(({ current, contentHash }) => !current || current.contentHash !== contentHash);

  if (pending.length === 0) return existing;

  const embeddings = await requestEmbeddings(pending.map((item) => item.sourceText));
  if (!embeddings) return existing;

  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index];
    const embedding = embeddings[index];
    if (!embedding) continue;

    if (item.current) {
      await db
        .update(productSearchEmbeddings)
        .set({
          model: DEFAULT_EMBED_MODEL,
          contentHash: item.contentHash,
          sourceText: item.sourceText,
          embedding,
          updatedAt: new Date(),
        })
        .where(eq(productSearchEmbeddings.id, item.current.id));
    } else {
      await db.insert(productSearchEmbeddings).values({
        productId: item.row.id,
        model: DEFAULT_EMBED_MODEL,
        contentHash: item.contentHash,
        sourceText: item.sourceText,
        embedding,
      });
    }
  }

  return db
    .select()
    .from(productSearchEmbeddings)
    .where(inArray(productSearchEmbeddings.productId, rows.map((row) => row.id)));
}

export async function embedQuery(query: string) {
  const embeddings = await requestEmbeddings([query]);
  return embeddings?.[0] ?? null;
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
