import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  products,
  providers,
  purchases,
  providerOriginVerifications,
} from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import { buildUsageSummary } from '../lib/tool-docs.js';
import {
  computeToolPolicy,
  endpointMatchesVerifiedOrigin,
  normalizeToolCapabilities,
  type ToolCapabilities,
} from '../lib/tool-policy.js';
import { listProductVersions } from './product-versions.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const publicToolSelection = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  logoUrl: products.logoUrl,
  description: products.description,
  category: products.category,
  tags: products.tags,
  pricePerCallUsd: products.pricePerCallUsd,
  inputSchema: products.inputSchema,
  outputSchema: products.outputSchema,
  executionConfig: products.executionConfig,
  capabilities: products.capabilities,
  manifestDigest: products.manifestDigest,
  currentVersion: products.currentVersion,
  moderationStatus: products.moderationStatus,
  updatedAt: products.updatedAt,
  providerId: providers.id,
  providerName: providers.name,
  providerTrustTier: providers.trustTier,
  providerVerifiedOrigin: providers.verifiedOrigin,
  providerVerifiedOrigins: sql<string[]>`coalesce((
    select jsonb_agg(${providerOriginVerifications.origin})
    from ${providerOriginVerifications}
    where ${providerOriginVerifications.providerId} = ${providers.id}
      and ${providerOriginVerifications.status} = 'verified'
      and ${providerOriginVerifications.expiresAt} > now()
  ), '[]'::jsonb)`,
  providerOriginVerifiedAt: providers.originVerifiedAt,
  providerStripeAccountStatus: providers.stripeAccountStatus,
  usageCount: sql<number>`(
    select count(*)::int from ${purchases}
    where ${purchases.productId} = ${products.id} and ${purchases.status} = 'completed'
  )`,
  uniqueUserCount: sql<number>`(
    select count(distinct ${purchases.userId})::int from ${purchases}
    where ${purchases.productId} = ${products.id} and ${purchases.status} = 'completed'
  )`,
};

type PublicToolRow = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  pricePerCallUsd: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
  capabilities: ToolCapabilities | null;
  manifestDigest: string | null;
  currentVersion: number;
  moderationStatus: 'clear' | 'flagged' | 'quarantined';
  updatedAt: Date;
  providerId: string;
  providerName: string;
  providerTrustTier: 'unverified' | 'basic' | 'verified' | 'premium';
  providerVerifiedOrigin: string | null;
  providerVerifiedOrigins: string[];
  providerOriginVerifiedAt: Date | null;
  providerStripeAccountStatus: string | null;
  usageCount: number;
  uniqueUserCount: number;
};

function toToolCard(row: PublicToolRow) {
  const amount = row.pricePerCallUsd;
  const config = row.executionConfig;
  const method = config?.method;
  const mappingEntries = Object.entries(
    (config?.paramMapping as Record<string, { target?: string; param?: string }> | undefined) ?? {},
  );
  const expectedDirectTarget = method === 'GET' ? 'query' : 'body';
  const directMappingsAreLossless = mappingEntries.every(
    ([field, mapping]) => mapping.target === expectedDirectTarget && mapping.param === field,
  );
  const hasStaticParams = Array.isArray(config?.staticParams) && config.staticParams.length > 0;
  const hasPathTemplate = typeof config?.baseUrl === 'string'
    && (/\{[^}]+\}/.test(config.baseUrl) || /%7B.+%7D/i.test(config.baseUrl));
  const standardizedEndpoint = config?.protocol === 'markgit.tool/v1'
    && typeof config.baseUrl === 'string'
    && (method === 'GET' || method === 'POST')
    && directMappingsAreLossless
    && !hasStaticParams
    && !hasPathTemplate
    ? {
        url: config.baseUrl,
        method: method as 'GET' | 'POST',
      }
    : null;
  const isFree = parseFloat(amount) === 0;
  const usage = buildUsageSummary(Number(row.usageCount), Number(row.uniqueUserCount));
  const capabilities = normalizeToolCapabilities(row.capabilities, row.executionConfig);
  const endpointVerified = endpointMatchesVerifiedOrigin(
    row.executionConfig,
    row.providerVerifiedOrigins,
  );
  const paymentVerified = row.providerStripeAccountStatus === 'active';
  let configuredOrigin: string | null = null;
  try {
    configuredOrigin = typeof row.executionConfig?.baseUrl === 'string'
      ? new URL(row.executionConfig.baseUrl).origin
      : null;
  } catch {
    configuredOrigin = null;
  }
  const policy = computeToolPolicy({
    productStatus: 'active',
    moderationStatus: row.moderationStatus,
    pricePerCallUsd: row.pricePerCallUsd,
    manifestDigest: row.manifestDigest,
    capabilities,
    endpointVerified,
    paymentVerified,
  });
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    description: row.description,
    category: row.category,
    tags: row.tags,
    provider: {
      id: row.providerId,
      name: row.providerName,
      trustTier: row.providerTrustTier,
    },
    version: {
      number: row.currentVersion,
      manifestDigest: row.manifestDigest,
      immutable: Boolean(row.manifestDigest),
    },
    trust: {
      provider: {
        tier: row.providerTrustTier,
        paymentVerified,
      },
      endpoint: {
        status: endpointVerified ? 'verified' as const : 'unverified' as const,
        origin: configuredOrigin,
        verifiedAt: configuredOrigin === row.providerVerifiedOrigin
          ? row.providerOriginVerifiedAt
          : null,
      },
      version: {
        status: row.manifestDigest ? 'versioned' as const : 'legacy_unversioned' as const,
        manifestDigest: row.manifestDigest,
      },
      behavior: {
        status: Number(row.uniqueUserCount) >= 100 ? 'established' as const : 'new' as const,
        evidence: 'markgit_calls' as const,
      },
    },
    risk: {
      level: policy.riskLevel,
      capabilities,
    },
    policy,
    usage,
    pricing: isFree
      ? { type: 'free' as const, currency: 'USD' as const, amount: '0.0000' }
      : { type: 'per_call' as const, currency: 'USD' as const, amount },
    inputSchema: row.inputSchema,
    outputSchema: row.outputSchema,
    access: isFree && standardizedEndpoint && policy.eligibleForAutoCall
      ? { mode: 'direct' as const, endpoint: standardizedEndpoint }
      : {
          mode: 'gateway' as const,
          endpoint: { method: 'POST' as const, path: `/v1/tools/${row.slug}/call` },
        },
    documentation: {
      json: `/v1/registry/tools/${row.slug}/docs`,
      openapi: `/v1/registry/tools/${row.slug}/openapi.json`,
      llms: `/v1/registry/tools/${row.slug}/llms.txt`,
      human: `/tools/${row.slug}`,
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

  const where = and(
    eq(products.status, 'active'),
    ne(products.moderationStatus, 'quarantined'),
    queryFilter,
  );
  const [rows, totals] = await Promise.all([
    selectPublicTools()
      .where(where)
      .orderBy(desc(sql`case when exists (
        select 1 from ${providerOriginVerifications}
        where ${providerOriginVerifications.providerId} = ${providers.id}
          and ${providerOriginVerifications.status} = 'verified'
          and ${providerOriginVerifications.expiresAt} > now()
      ) then 1 else 0 end`), desc(products.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(products)
      .innerJoin(providers, eq(products.providerId, providers.id))
      .where(where),
  ]);

  return { tools: rows.map(toToolCard), total: Number(totals[0]?.value ?? 0) };
}

export async function listAllPublicTools() {
  const rows = await selectPublicTools()
    .where(and(eq(products.status, 'active'), ne(products.moderationStatus, 'quarantined')))
    .orderBy(desc(sql`case when exists (
      select 1 from ${providerOriginVerifications}
      where ${providerOriginVerifications.providerId} = ${providers.id}
        and ${providerOriginVerifications.status} = 'verified'
        and ${providerOriginVerifications.expiresAt} > now()
    ) then 1 else 0 end`), desc(products.updatedAt));
  return rows.map(toToolCard);
}

export async function getPublicTool(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier)
    ? eq(products.id, identifier)
    : eq(products.slug, identifier);

  const [row] = await selectPublicTools()
    .where(and(
      eq(products.status, 'active'),
      ne(products.moderationStatus, 'quarantined'),
      identifierFilter,
    ))
    .limit(1);

  if (!row) throw new NotFoundError('Tool');
  return toToolCard(row);
}

export async function listPublicToolVersions(identifier: string) {
  const tool = await getPublicTool(identifier);
  const versions = await listProductVersions(tool.id);
  return {
    tool: { id: tool.id, slug: tool.slug, name: tool.name },
    versions: versions.map((version) => ({
      version: version.version,
      manifestDigest: version.manifestDigest,
      endpointOrigin: version.endpointOrigin,
      pricePerCallUsd: version.pricePerCallUsd,
      capabilities: version.capabilities,
      manifest: version.manifest,
      createdAt: version.createdAt,
    })),
  };
}
