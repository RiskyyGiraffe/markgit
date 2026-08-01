import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  harnessRuns,
  products,
  providerOriginVerifications,
  providers,
} from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import type { HarnessConfig } from '../lib/harness-manifest.js';
import {
  computeToolPolicy,
  endpointMatchesVerifiedOrigin,
  normalizeToolCapabilities,
  type ToolCapabilities,
} from '../lib/tool-policy.js';
import { listProductVersions } from './product-versions.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const publicHarnessSelection = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  logoUrl: products.logoUrl,
  description: products.description,
  category: products.category,
  tags: products.tags,
  pricePerRunUsd: products.pricePerCallUsd,
  inputSchema: products.inputSchema,
  outputSchema: products.outputSchema,
  executionConfig: products.executionConfig,
  harnessConfig: products.harnessConfig,
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
    select count(*)::int from ${harnessRuns}
    where ${harnessRuns.productId} = ${products.id}
      and ${harnessRuns.status} not in ('pending', 'starting', 'failed')
  )`,
  uniqueUserCount: sql<number>`(
    select count(distinct ${harnessRuns.userId})::int from ${harnessRuns}
    where ${harnessRuns.productId} = ${products.id}
      and ${harnessRuns.status} not in ('pending', 'starting', 'failed')
  )`,
};

type PublicHarnessRow = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  pricePerRunUsd: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
  harnessConfig: Record<string, unknown> | null;
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

function compactCount(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function toHarnessCard(row: PublicHarnessRow) {
  const config = row.harnessConfig as unknown as HarnessConfig | null;
  if (!config) throw new Error(`Active harness ${row.slug} is missing harnessConfig`);
  const capabilities = normalizeToolCapabilities(row.capabilities, row.executionConfig);
  const endpointVerified = endpointMatchesVerifiedOrigin(row.executionConfig, row.providerVerifiedOrigins);
  const paymentVerified = row.providerStripeAccountStatus === 'active';
  const policy = computeToolPolicy({
    productStatus: 'active',
    moderationStatus: row.moderationStatus,
    pricePerCallUsd: row.pricePerRunUsd,
    manifestDigest: row.manifestDigest,
    capabilities,
    endpointVerified,
    paymentVerified,
  });
  let runtimeOrigin: string | null = null;
  try {
    runtimeOrigin = new URL(config.runtime.startUrl).origin;
  } catch {
    runtimeOrigin = null;
  }
  const runs = Number(row.usageCount);
  const users = Number(row.uniqueUserCount);
  return {
    kind: 'harness' as const,
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
      provider: { tier: row.providerTrustTier, paymentVerified },
      runtime: {
        status: endpointVerified ? 'verified' as const : 'unverified' as const,
        origin: runtimeOrigin,
        verifiedAt: runtimeOrigin === row.providerVerifiedOrigin ? row.providerOriginVerifiedAt : null,
      },
      version: {
        status: row.manifestDigest ? 'versioned' as const : 'legacy_unversioned' as const,
        manifestDigest: row.manifestDigest,
      },
    },
    risk: { level: policy.riskLevel, capabilities },
    policy,
    pricing: {
      type: 'free' as const,
      chargedByMarkgit: false as const,
      currency: 'USD' as const,
      amount: '0.0000',
      externalApiCosts: config.externalApiCosts,
      note: config.pricingNote ?? null,
      externalApis: config.access.externalApis.map((api) => ({ id: api.id, name: api.name, pricing: api.pricing })),
    },
    usage: {
      runs,
      uniqueUsers: users,
      tracked: true as const,
      coverage: 'markgit_harness_runs' as const,
      runsLabel: runs < 1_000 ? 'Under 1K runs' : `${compactCount(runs)} runs`,
      usersLabel: users < 100 ? 'Under 100 users' : `${compactCount(users)} users`,
    },
    inputSchema: row.inputSchema,
    outputSchema: row.outputSchema,
    access: config.access,
    loop: config.loop,
    compaction: config.compaction,
    invocation: {
      start: { method: 'POST' as const, path: `/v1/harnesses/${row.slug}/runs` },
      monitor: { method: 'GET' as const, pathTemplate: '/v1/harness-runs/{runId}' },
      events: { method: 'GET' as const, pathTemplate: '/v1/harness-runs/{runId}/events?after={sequence}' },
      cancel: { method: 'POST' as const, pathTemplate: '/v1/harness-runs/{runId}/cancel' },
      authentication: 'Bearer Markgit API key',
      vendorNeutral: true,
    },
    observability: {
      mode: 'provider_attested' as const,
      markgitEnforcesDeclaredEventReferences: true,
      limitation: 'Provider-hosted network traffic is outside Markgit compute and cannot be independently observed. Verified origins and signed run callbacks establish identity; a provider could still omit an event.',
    },
    documentation: {
      json: `/v1/registry/harnesses/${row.slug}/docs`,
      openapi: `/v1/registry/harnesses/${row.slug}/openapi.json`,
      llms: `/v1/registry/harnesses/${row.slug}/llms.txt`,
      human: `/harnesses/${row.slug}`,
    },
    updatedAt: row.updatedAt,
  };
}

function selectHarnesses() {
  return db.select(publicHarnessSelection).from(products).innerJoin(providers, eq(products.providerId, providers.id));
}

export async function listPublicHarnesses(query = '', limit = 20, offset = 0) {
  const normalized = query.trim();
  const filter = normalized ? or(
    ilike(products.name, `%${normalized}%`),
    ilike(products.description, `%${normalized}%`),
    ilike(products.category, `%${normalized}%`),
  ) : undefined;
  const where = and(
    eq(products.status, 'active'),
    eq(products.kind, 'harness'),
    ne(products.moderationStatus, 'quarantined'),
    filter,
  );
  const [rows, totals] = await Promise.all([
    selectHarnesses().where(where).orderBy(desc(products.updatedAt)).limit(limit).offset(offset),
    db.select({ value: sql<number>`count(*)::int` }).from(products).where(where),
  ]);
  return { harnesses: rows.map(toHarnessCard), total: Number(totals[0]?.value ?? 0) };
}

export async function listAllPublicHarnesses() {
  const rows = await selectHarnesses().where(and(
    eq(products.status, 'active'),
    eq(products.kind, 'harness'),
    ne(products.moderationStatus, 'quarantined'),
  )).orderBy(desc(products.updatedAt));
  return rows.map(toHarnessCard);
}

export async function getPublicHarness(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier) ? eq(products.id, identifier) : eq(products.slug, identifier);
  const [row] = await selectHarnesses().where(and(
    eq(products.status, 'active'),
    eq(products.kind, 'harness'),
    ne(products.moderationStatus, 'quarantined'),
    identifierFilter,
  )).limit(1);
  if (!row) throw new NotFoundError('Harness');
  return toHarnessCard(row);
}

export async function listPublicHarnessVersions(identifier: string) {
  const harness = await getPublicHarness(identifier);
  return {
    harness: { id: harness.id, slug: harness.slug, name: harness.name },
    versions: await listProductVersions(harness.id),
  };
}
