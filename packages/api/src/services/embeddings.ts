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

function boundedText(value: unknown, maxLength = 12_000) {
  const normalized = normalizeText(value).replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}…`;
}

export function buildProductEmbeddingText(product: {
  name: string;
  slug: string;
  kind: string;
  description: string | null;
  category: string | null;
  tags: string[];
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
  harnessConfig: Record<string, unknown> | null;
  mcpConfig: Record<string, unknown> | null;
  skillConfig: Record<string, unknown> | null;
  sourceMetadata: Record<string, unknown> | null;
  capabilities: Record<string, unknown> | null;
}) {
  return [
    `name: ${product.name}`,
    `slug: ${product.slug}`,
    `kind: ${product.kind}`,
    `description: ${boundedText(product.description)}`,
    `category: ${boundedText(product.category)}`,
    `tags: ${product.tags.join(', ')}`,
    `inputs and accepted data: ${boundedText(product.inputSchema)}`,
    `outputs, return value, and returned data: ${boundedText(product.outputSchema)}`,
    `tool execution: ${boundedText(product.executionConfig)}`,
    `custom loop behavior: ${boundedText(product.harnessConfig)}`,
    `MCP server and tools: ${boundedText(product.mcpConfig)}`,
    `skill instructions and markdown: ${boundedText(product.skillConfig)}`,
    `source documentation and README: ${boundedText(product.sourceMetadata, 12_000)}`,
    `capabilities and access: ${boundedText(product.capabilities)}`,
  ].join('\n').slice(0, 30_000);
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
      slug: products.slug,
      kind: products.kind,
      description: products.description,
      category: products.category,
      tags: products.tags,
      inputSchema: products.inputSchema,
      outputSchema: products.outputSchema,
      executionConfig: products.executionConfig,
      harnessConfig: products.harnessConfig,
      mcpConfig: products.mcpConfig,
      skillConfig: products.skillConfig,
      sourceMetadata: products.sourceMetadata,
      capabilities: products.capabilities,
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

  for (let batchStart = 0; batchStart < pending.length; batchStart += 50) {
    const batch = pending.slice(batchStart, batchStart + 50);
    const embeddings = await requestEmbeddings(batch.map((item) => item.sourceText));
    if (!embeddings) continue;
    for (let index = 0; index < batch.length; index += 1) {
      const item = batch[index];
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
        }).onConflictDoNothing({ target: productSearchEmbeddings.productId });
      }
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
