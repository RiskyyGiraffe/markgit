import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, providers } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const publicToolSelection = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  description: products.description,
  category: products.category,
  tags: products.tags,
  pricePerCallUsd: products.pricePerCallUsd,
  inputSchema: products.inputSchema,
  outputSchema: products.outputSchema,
  executionConfig: products.executionConfig,
  updatedAt: products.updatedAt,
  providerId: providers.id,
  providerName: providers.name,
  providerTrustTier: providers.trustTier,
};

type PublicToolRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  pricePerCallUsd: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
  updatedAt: Date;
  providerId: string;
  providerName: string;
  providerTrustTier: 'unverified' | 'basic' | 'verified' | 'premium';
};

function toToolCard(row: PublicToolRow) {
  const amount = row.pricePerCallUsd;
  const standardizedEndpoint = row.executionConfig?.protocol === 'markgit.tool/v1'
    && typeof row.executionConfig.baseUrl === 'string'
    && (row.executionConfig.method === 'GET' || row.executionConfig.method === 'POST')
    ? { url: row.executionConfig.baseUrl, method: row.executionConfig.method }
    : null;
  const isFree = parseFloat(amount) === 0;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: row.tags,
    provider: {
      id: row.providerId,
      name: row.providerName,
      trustTier: row.providerTrustTier,
    },
    pricing: isFree
      ? { type: 'free' as const, currency: 'USD', amount: '0.0000' }
      : { type: 'per_call' as const, currency: 'USD', amount },
    inputSchema: row.inputSchema,
    outputSchema: row.outputSchema,
    access: isFree && standardizedEndpoint
      ? { mode: 'direct' as const, endpoint: standardizedEndpoint }
      : {
          mode: 'gateway' as const,
          endpoint: { method: 'POST' as const, path: `/v1/tools/${row.slug}/call` },
        },
    updatedAt: row.updatedAt,
  };
}

function selectPublicTools() {
  return db
    .select(publicToolSelection)
    .from(products)
    .innerJoin(providers, eq(products.providerId, providers.id));
}

export async function listPublicTools(query = '', limit = 20, offset = 0) {
  const normalizedQuery = query.trim();
  const queryFilter = normalizedQuery
    ? or(
        ilike(products.name, `%${normalizedQuery}%`),
        ilike(products.description, `%${normalizedQuery}%`),
        ilike(products.category, `%${normalizedQuery}%`),
      )
    : undefined;

  const rows = await selectPublicTools()
    .where(and(eq(products.status, 'active'), queryFilter))
    .orderBy(desc(products.updatedAt))
    .limit(limit)
    .offset(offset);

  return { tools: rows.map(toToolCard), total: rows.length };
}

export async function getPublicTool(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier)
    ? eq(products.id, identifier)
    : eq(products.slug, identifier);

  const [row] = await selectPublicTools()
    .where(and(eq(products.status, 'active'), identifierFilter))
    .limit(1);

  if (!row) throw new NotFoundError('Tool');
  return toToolCard(row);
}
