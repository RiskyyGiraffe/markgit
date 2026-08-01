import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, providers } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import type { SkillConfig } from '../lib/skill-manifest.js';
import { publicSourceMetadata, type IndexedSourceMetadata } from '../lib/source-metadata.js';
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
  skillConfig: products.skillConfig,
  sourceMetadata: products.sourceMetadata,
  manifestDigest: products.manifestDigest,
  currentVersion: products.currentVersion,
  updatedAt: products.updatedAt,
  providerId: providers.id,
  providerName: providers.name,
  providerTrustTier: providers.trustTier,
};

type Row = typeof products.$inferSelect & {
  providerId: string;
  providerName: string;
  providerTrustTier: 'unverified' | 'basic' | 'verified' | 'premium';
};

function toCard(row: Pick<Row, keyof typeof selection>) {
  const config = row.skillConfig as unknown as SkillConfig | null;
  if (!config) throw new Error(`Active skill ${row.slug} is missing skillConfig`);
  return {
    kind: 'skill' as const,
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    description: row.description,
    category: row.category,
    tags: row.tags,
    provider: { id: row.providerId, name: row.providerName, trustTier: row.providerTrustTier },
    version: { number: row.currentVersion, manifestDigest: row.manifestDigest, immutable: Boolean(row.manifestDigest) },
    format: config.format,
    entrypoint: config.entrypoint,
    source: config.source,
    compatibility: config.compatibility,
    installation: {
      commands: config.install,
      automatic: false as const,
      note: 'Review the source and license before running an installation command. Markgit does not host or execute this package.',
    },
    contents: config.contents,
    pricing: { type: 'free' as const, chargedByMarkgit: false as const, currency: 'USD' as const, amount: '0.0000' },
    provenance: {
      sourceHosted: true as const,
      indexedByMarkgit: true as const,
      publisher: config.source.publisher ?? null,
      repository: config.source.repositoryUrl,
      revision: config.source.revision,
    },
    sourceMetadata: publicSourceMetadata(row.sourceMetadata as unknown as IndexedSourceMetadata | null),
    usage: { tracked: false as const, label: 'Source popularity' },
    documentation: {
      json: `/v1/registry/skills/${row.slug}/docs`,
      llms: `/v1/registry/skills/${row.slug}/llms.txt`,
      review: `/v1/registry/skills/${row.slug}/review.md`,
      human: `/skills/${row.slug}`,
    },
    updatedAt: row.updatedAt,
  };
}

function selectSkills() {
  return db.select(selection).from(products).innerJoin(providers, eq(products.providerId, providers.id));
}

export async function listPublicSkills(query = '', limit = 20, offset = 0) {
  const normalized = query.trim();
  const filter = normalized ? or(
    ilike(products.name, `%${normalized}%`),
    ilike(products.description, `%${normalized}%`),
    ilike(products.category, `%${normalized}%`),
  ) : undefined;
  const where = and(eq(products.status, 'active'), eq(products.kind, 'skill'), ne(products.moderationStatus, 'quarantined'), filter);
  const [rows, totals] = await Promise.all([
    selectSkills().where(where).orderBy(desc(products.updatedAt)).limit(limit).offset(offset),
    db.select({ value: sql<number>`count(*)::int` }).from(products).where(where),
  ]);
  return { skills: rows.map(toCard), total: Number(totals[0]?.value ?? 0) };
}

export async function listAllPublicSkills() {
  const rows = await selectSkills().where(and(
    eq(products.status, 'active'),
    eq(products.kind, 'skill'),
    ne(products.moderationStatus, 'quarantined'),
  )).orderBy(desc(products.updatedAt));
  return rows.map(toCard);
}

export async function getPublicSkill(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier) ? eq(products.id, identifier) : eq(products.slug, identifier);
  const [row] = await selectSkills().where(and(
    eq(products.status, 'active'),
    eq(products.kind, 'skill'),
    ne(products.moderationStatus, 'quarantined'),
    identifierFilter,
  )).limit(1);
  if (!row) throw new NotFoundError('Skill');
  return toCard(row);
}

export async function getPublicSkillReview(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier) ? eq(products.id, identifier) : eq(products.slug, identifier);
  const [row] = await db.select({ sourceMetadata: products.sourceMetadata }).from(products).where(and(
    eq(products.status, 'active'),
    eq(products.kind, 'skill'),
    ne(products.moderationStatus, 'quarantined'),
    identifierFilter,
  )).limit(1);
  if (!row) throw new NotFoundError('Skill');
  const metadata = row.sourceMetadata as unknown as IndexedSourceMetadata | null;
  if (!metadata?.review.markdown) throw new NotFoundError('Skill review markdown');
  return metadata.review;
}

export async function listPublicSkillVersions(identifier: string) {
  const skill = await getPublicSkill(identifier);
  return { skill: { id: skill.id, slug: skill.slug, name: skill.name }, versions: await listProductVersions(skill.id) };
}
