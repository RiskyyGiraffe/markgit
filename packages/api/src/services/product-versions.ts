import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, productVersions } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import {
  digestToolManifest,
  normalizeToolCapabilities,
  type ToolCapabilities,
} from '../lib/tool-policy.js';

type VersionableProduct = {
  id: string;
  providerId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  kind: 'tool' | 'harness' | 'mcp' | 'skill';
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
  harnessConfig: Record<string, unknown> | null;
  mcpConfig: Record<string, unknown> | null;
  skillConfig: Record<string, unknown> | null;
  capabilities: ToolCapabilities | null;
  pricePerCallUsd: string;
  tags: string[];
  manifestDigest: string | null;
  currentVersion: number;
};

export function buildVersionManifest(product: VersionableProduct, capabilities: ToolCapabilities) {
  return {
    schemaVersion: product.kind === 'harness'
      ? 'markgit.harness-version/v1'
      : product.kind === 'mcp'
        ? 'markgit.mcp-version/v1'
        : product.kind === 'skill'
          ? 'markgit.skill-version/v1'
          : 'markgit.tool-version/v1',
    productId: product.id,
    providerId: product.providerId,
    name: product.name,
    slug: product.slug,
    logoUrl: product.logoUrl,
    description: product.description,
    category: product.category,
    kind: product.kind,
    tags: product.tags,
    inputSchema: product.inputSchema,
    outputSchema: product.outputSchema,
    executionConfig: product.executionConfig,
    ...(product.kind === 'harness' ? { harnessConfig: product.harnessConfig } : {}),
    ...(product.kind === 'mcp' ? { mcpConfig: product.mcpConfig } : {}),
    ...(product.kind === 'skill' ? { skillConfig: product.skillConfig } : {}),
    capabilities,
    pricing: product.kind !== 'tool'
      ? { chargedByMarkgit: false, amountUsd: '0.0000', currency: 'USD' }
      : { amountPerCallUsd: product.pricePerCallUsd, currency: 'USD' },
  } satisfies Record<string, unknown>;
}

function endpointOrigin(executionConfig: Record<string, unknown> | null): string {
  const baseUrl = executionConfig?.baseUrl;
  if (typeof baseUrl !== 'string') throw new ValidationError('Tool execution base URL is required');
  try {
    return new URL(baseUrl).origin;
  } catch {
    throw new ValidationError('Tool execution base URL is invalid');
  }
}

export async function ensureProductVersion(productId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${productId}, 0))`);
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw new NotFoundError('Product');

    const capabilities = normalizeToolCapabilities(product.capabilities, product.executionConfig);
    const manifest = buildVersionManifest(product, capabilities);
    const manifestDigest = digestToolManifest(manifest);

    const [existing] = await tx
      .select()
      .from(productVersions)
      .where(and(
        eq(productVersions.productId, product.id),
        eq(productVersions.manifestDigest, manifestDigest),
      ))
      .limit(1);
    if (existing) {
      if (product.manifestDigest !== manifestDigest || !product.capabilities) {
        await tx
          .update(products)
          .set({
            manifestDigest,
            capabilities,
            currentVersion: existing.version,
            updatedAt: new Date(),
          })
          .where(eq(products.id, product.id));
      }
      return existing;
    }

    const version = product.manifestDigest ? product.currentVersion + 1 : product.currentVersion;
    const [created] = await tx
      .insert(productVersions)
      .values({
        productId: product.id,
        version,
        manifestDigest,
        manifest,
        kind: product.kind,
        capabilities,
        endpointOrigin: endpointOrigin(product.executionConfig),
        pricePerCallUsd: product.pricePerCallUsd,
      })
      .returning();

    await tx
      .update(products)
      .set({ manifestDigest, capabilities, currentVersion: version, updatedAt: new Date() })
      .where(eq(products.id, product.id));
    return created;
  });
}

export async function listProductVersions(productId: string) {
  return db
    .select()
    .from(productVersions)
    .where(eq(productVersions.productId, productId))
    .orderBy(productVersions.version);
}
