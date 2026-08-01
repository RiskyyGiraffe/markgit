import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, providers, userQuicklist } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { ToolPolicyDecision } from '../lib/tool-policy.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const AUTHORIZATION_MODES = ['ask_paid', 'ask_every', 'never_ask'] as const;
export type AuthorizationMode = (typeof AUTHORIZATION_MODES)[number];

export function validateAuthorizationMode(value: unknown): AuthorizationMode {
  if (!AUTHORIZATION_MODES.includes(value as AuthorizationMode)) {
    throw new ValidationError('authorizationMode must be ask_paid, ask_every, or never_ask');
  }
  return value as AuthorizationMode;
}

export function applyQuicklistAuthorization(
  base: ToolPolicyDecision,
  preference: { authorizationMode: string; authorizationManifestDigest: string | null } | null,
  input: { isPaid: boolean; manifestDigest: string | null },
): ToolPolicyDecision {
  if (!preference || !base.callable || base.approval.requirement === 'blocked') return base;
  const mode = validateAuthorizationMode(preference.authorizationMode);
  const versionCurrent = Boolean(
    input.manifestDigest && preference.authorizationManifestDigest === input.manifestDigest,
  );
  let requirement = base.approval.requirement;
  const reasons = [...base.reasons];

  if (mode === 'ask_every' && requirement !== 'explicit_unverified') {
    requirement = 'per_call';
    reasons.push('your quicklist setting asks before every call');
  } else if (mode === 'ask_paid' && input.isPaid && requirement !== 'explicit_unverified') {
    requirement = 'per_call';
    reasons.push('your quicklist setting asks before every charged call');
  } else if (mode === 'never_ask') {
    if (versionCurrent && requirement !== 'explicit_unverified') {
      requirement = 'covered_by_user_policy';
      reasons.push('this exact tool version has standing user authorization');
    } else if (!versionCurrent) {
      reasons.push('standing authorization is stale because the tool version changed');
    }
  }

  return {
    ...base,
    eligibleForAutoCall: requirement === 'covered_by_user_policy',
    approval: { ...base.approval, requirement },
    reasons,
    userAuthorization: {
      mode,
      label: mode === 'ask_every'
        ? 'Ask every call'
        : mode === 'never_ask'
          ? "Don't ask"
          : 'Ask for charged calls',
      versionCurrent: mode !== 'never_ask' || versionCurrent,
    },
  };
}

async function resolveActiveTool(identifier: string) {
  const identifierFilter = UUID_PATTERN.test(identifier)
    ? eq(products.id, identifier)
    : eq(products.slug, identifier);
  const [product] = await db
    .select()
    .from(products)
    .where(and(
      identifierFilter,
      eq(products.kind, 'tool'),
      eq(products.status, 'active'),
    ))
    .limit(1);
  if (!product) throw new NotFoundError('Tool');
  return product;
}

export async function listQuicklist(userId: string) {
  const rows = await db
    .select({
      id: userQuicklist.id,
      authorizationMode: userQuicklist.authorizationMode,
      authorizationManifestDigest: userQuicklist.authorizationManifestDigest,
      createdAt: userQuicklist.createdAt,
      updatedAt: userQuicklist.updatedAt,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      logoUrl: products.logoUrl,
      description: products.description,
      category: products.category,
      tags: products.tags,
      pricePerCallUsd: products.pricePerCallUsd,
      manifestDigest: products.manifestDigest,
      providerId: providers.id,
      providerName: providers.name,
      providerTrustTier: providers.trustTier,
    })
    .from(userQuicklist)
    .innerJoin(products, eq(userQuicklist.productId, products.id))
    .innerJoin(providers, eq(products.providerId, providers.id))
    .where(and(eq(userQuicklist.userId, userId), eq(products.status, 'active')))
    .orderBy(desc(userQuicklist.updatedAt));

  return {
    entries: rows.map((row) => ({
      id: row.id,
      tool: {
        id: row.productId,
        slug: row.slug,
        name: row.name,
        logoUrl: row.logoUrl,
        description: row.description,
        category: row.category,
        tags: row.tags,
        provider: { id: row.providerId, name: row.providerName, trustTier: row.providerTrustTier },
        pricing: {
          type: Number.parseFloat(row.pricePerCallUsd) > 0 ? 'per_call' as const : 'free' as const,
          amount: row.pricePerCallUsd,
          currency: 'USD' as const,
        },
        manifestDigest: row.manifestDigest,
      },
      authorization: {
        mode: validateAuthorizationMode(row.authorizationMode),
        label: row.authorizationMode === 'ask_every'
          ? 'Ask every call'
          : row.authorizationMode === 'never_ask'
            ? "Don't ask"
            : 'Ask for charged calls',
        versionCurrent: row.authorizationMode !== 'never_ask'
          || Boolean(row.manifestDigest && row.authorizationManifestDigest === row.manifestDigest),
        manifestDigest: row.authorizationManifestDigest,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    total: rows.length,
  };
}

export async function upsertQuicklistEntry(userId: string, identifier: string, authorizationMode: AuthorizationMode) {
  const product = await resolveActiveTool(identifier);
  const authorizationManifestDigest = authorizationMode === 'never_ask' ? product.manifestDigest : null;
  const [entry] = await db
    .insert(userQuicklist)
    .values({ userId, productId: product.id, authorizationMode, authorizationManifestDigest })
    .onConflictDoUpdate({
      target: [userQuicklist.userId, userQuicklist.productId],
      set: { authorizationMode, authorizationManifestDigest, updatedAt: new Date() },
    })
    .returning();
  return { entry, tool: { id: product.id, slug: product.slug, name: product.name } };
}

export async function removeQuicklistEntry(userId: string, identifier: string) {
  const product = await resolveActiveTool(identifier);
  await db.delete(userQuicklist).where(and(
    eq(userQuicklist.userId, userId),
    eq(userQuicklist.productId, product.id),
  ));
  return { removed: true, tool: { id: product.id, slug: product.slug, name: product.name } };
}

export async function getQuicklistPreference(userId: string, productId: string) {
  const [entry] = await db
    .select({
      authorizationMode: userQuicklist.authorizationMode,
      authorizationManifestDigest: userQuicklist.authorizationManifestDigest,
    })
    .from(userQuicklist)
    .where(and(eq(userQuicklist.userId, userId), eq(userQuicklist.productId, productId)))
    .limit(1);
  return entry ?? null;
}
