import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, providerOriginVerifications, providers } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import type { McpConfig } from '../lib/mcp-manifest.js';
import { publicSourceMetadata, type IndexedSourceMetadata } from '../lib/source-metadata.js';
import { computeToolPolicy, endpointMatchesVerifiedOrigin, normalizeToolCapabilities, type ToolCapabilities } from '../lib/tool-policy.js';
import { listProductVersions } from './product-versions.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const selection = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  logoUrl: products.logoUrl,
  description: products.description,
  category: products.category,
  tags: products.tags,
  executionConfig: products.executionConfig,
  mcpConfig: products.mcpConfig,
  sourceMetadata: products.sourceMetadata,
  capabilities: products.capabilities,
  manifestDigest: products.manifestDigest,
  currentVersion: products.currentVersion,
  moderationStatus: products.moderationStatus,
  updatedAt: products.updatedAt,
  providerId: providers.id,
  providerName: providers.name,
  providerTrustTier: providers.trustTier,
  providerVerifiedOrigins: sql<string[]>`coalesce((
    select jsonb_agg(${providerOriginVerifications.origin})
    from ${providerOriginVerifications}
    where ${providerOriginVerifications.providerId} = ${providers.id}
      and ${providerOriginVerifications.status} = 'verified'
      and ${providerOriginVerifications.expiresAt} > now()
  ), '[]'::jsonb)`,
};

type Row = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  executionConfig: Record<string, unknown> | null;
  mcpConfig: Record<string, unknown> | null;
  sourceMetadata: Record<string, unknown> | null;
  capabilities: ToolCapabilities | null;
  manifestDigest: string | null;
  currentVersion: number;
  moderationStatus: 'clear' | 'flagged' | 'quarantined';
  updatedAt: Date;
  providerId: string;
  providerName: string;
  providerTrustTier: 'unverified' | 'basic' | 'verified' | 'premium';
  providerVerifiedOrigins: string[];
};

function toCard(row: Row) {
  const config = row.mcpConfig as unknown as McpConfig | null;
  if (!config) throw new Error(`Active MCP ${row.slug} is missing mcpConfig`);
  const capabilities = normalizeToolCapabilities(row.capabilities, row.executionConfig);
  const endpointVerified = endpointMatchesVerifiedOrigin(row.executionConfig, row.providerVerifiedOrigins);
  const policy = computeToolPolicy({
    productStatus: 'active',
    moderationStatus: row.moderationStatus,
    pricePerCallUsd: '0.0000',
    manifestDigest: row.manifestDigest,
    capabilities,
    endpointVerified,
    paymentVerified: true,
  });
  return {
    kind: 'mcp' as const,
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    description: row.description,
    category: row.category,
    tags: row.tags,
    provider: { id: row.providerId, name: row.providerName, trustTier: row.providerTrustTier },
    version: { number: row.currentVersion, manifestDigest: row.manifestDigest, immutable: Boolean(row.manifestDigest) },
    trust: {
      provider: { tier: row.providerTrustTier },
      endpoint: { status: endpointVerified ? 'verified' as const : 'unverified' as const, origin: new URL(config.server.url).origin },
    },
    risk: { level: policy.riskLevel, capabilities },
    policy,
    pricing: { type: 'free' as const, chargedByMarkgit: false as const, currency: 'USD' as const, amount: '0.0000' },
    server: config.server,
    features: config.features,
    source: config.source ?? null,
    sourceMetadata: publicSourceMetadata(row.sourceMetadata as unknown as IndexedSourceMetadata | null),
    connect: {
      protocol: 'mcp' as const,
      transport: config.server.transport,
      url: config.server.url,
      auth: config.server.auth,
      proxiedByMarkgit: false as const,
    },
    usage: { tracked: false as const, label: 'Source popularity' },
    documentation: {
      json: `/v1/registry/mcps/${row.slug}/docs`,
      llms: `/v1/registry/mcps/${row.slug}/llms.txt`,
      review: `/v1/registry/mcps/${row.slug}/review.md`,
      human: `/mcps/${row.slug}`,
    },
    updatedAt: row.updatedAt,
  };
}

function selectMcps() {
  return db.select(selection).from(products).innerJoin(providers, eq(products.providerId, providers.id));
}

export async function listPublicMcps(query = '', limit = 20, offset = 0) {
  const normalized = query.trim();
  const filter = normalized ? or(
    ilike(products.name, `%${normalized}%`),
    ilike(products.description, `%${normalized}%`),
    ilike(products.category, `%${normalized}%`),
  ) : undefined;
  const where = and(eq(products.status, 'active'), eq(products.kind, 'mcp'), ne(products.moderationStatus, 'quarantined'), filter);
  const [rows, totals] = await Promise.all([
    selectMcps().where(where).orderBy(desc(products.updatedAt)).limit(limit).offset(offset),
    db.select({ value: sql<number>`count(*)::int` }).from(products).where(where),
  ]);
  return { mcps: rows.map(toCard), total: Number(totals[0]?.value ?? 0) };
}

export async function listAllPublicMcps() {
  const rows = await selectMcps().where(and(
    eq(products.status, 'active'),
    eq(products.kind, 'mcp'),
    ne(products.moderationStatus, 'quarantined'),
  )).orderBy(desc(products.updatedAt));
  return rows.map(toCard);
}

export async function getPublicMcp(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier) ? eq(products.id, identifier) : eq(products.slug, identifier);
  const [row] = await selectMcps().where(and(
    eq(products.status, 'active'),
    eq(products.kind, 'mcp'),
    ne(products.moderationStatus, 'quarantined'),
    identifierFilter,
  )).limit(1);
  if (!row) throw new NotFoundError('MCP server');
  return toCard(row);
}

export async function getPublicMcpReview(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier) ? eq(products.id, identifier) : eq(products.slug, identifier);
  const [row] = await db.select({ sourceMetadata: products.sourceMetadata }).from(products).where(and(
    eq(products.status, 'active'),
    eq(products.kind, 'mcp'),
    ne(products.moderationStatus, 'quarantined'),
    identifierFilter,
  )).limit(1);
  if (!row) throw new NotFoundError('MCP server');
  const metadata = row.sourceMetadata as unknown as IndexedSourceMetadata | null;
  if (!metadata?.review.markdown) throw new NotFoundError('MCP review markdown');
  return metadata.review;
}

export async function listPublicMcpVersions(identifier: string) {
  const mcp = await getPublicMcp(identifier);
  return { mcp: { id: mcp.id, slug: mcp.slug, name: mcp.name }, versions: await listProductVersions(mcp.id) };
}
