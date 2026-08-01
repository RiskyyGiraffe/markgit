import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { providerOriginVerifications, providers } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { safeFetchText } from '../lib/safe-fetch.js';
import { getProviderByUserId } from './providers.js';

const CHALLENGE_TTL_MS = 30 * 60 * 1000;
const VERIFIED_ORIGIN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function hashChallenge(challenge: string) {
  return createHash('sha256').update(challenge).digest('hex');
}

function normalizeOrigin(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ValidationError('origin must be a valid URL');
  }
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && isLocal && url.protocol === 'http:')) {
    throw new ValidationError('origin must use HTTPS');
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new ValidationError('origin must contain only scheme, hostname, and optional port');
  }
  return url.origin;
}

export async function createOriginVerification(userId: string, rawOrigin: string) {
  const provider = await getProviderByUserId(userId);
  if (!provider) throw new NotFoundError('Provider');
  const origin = normalizeOrigin(rawOrigin);
  const challenge = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  const [verification] = await db
    .insert(providerOriginVerifications)
    .values({
      providerId: provider.id,
      origin,
      challengeHash: hashChallenge(challenge),
      expiresAt,
    })
    .returning({
      id: providerOriginVerifications.id,
      origin: providerOriginVerifications.origin,
      status: providerOriginVerifications.status,
      expiresAt: providerOriginVerifications.expiresAt,
    });

  return {
    ...verification,
    verificationUrl: `${origin}/.well-known/markgit.json`,
    file: {
      providerId: provider.id,
      challenge,
    },
  };
}

export async function verifyOrigin(userId: string, verificationId: string) {
  const provider = await getProviderByUserId(userId);
  if (!provider) throw new NotFoundError('Provider');
  const [verification] = await db
    .select()
    .from(providerOriginVerifications)
    .where(and(
      eq(providerOriginVerifications.id, verificationId),
      eq(providerOriginVerifications.providerId, provider.id),
    ))
    .limit(1);
  if (!verification) throw new NotFoundError('Origin verification');
  if (verification.expiresAt < new Date()) {
    await db
      .update(providerOriginVerifications)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(providerOriginVerifications.id, verification.id));
    throw new ValidationError('Origin verification challenge has expired');
  }
  if (verification.status === 'verified') {
    return {
      id: verification.id,
      origin: verification.origin,
      status: 'verified' as const,
      expiresAt: verification.expiresAt,
    };
  }

  let body: { providerId?: unknown; challenge?: unknown };
  try {
    const response = await safeFetchText(`${verification.origin}/.well-known/markgit.json`, {
      headers: { Accept: 'application/json' },
      timeoutMs: 10_000,
      maxResponseBytes: 64_000,
      maxRedirects: 2,
      redirectPolicy: 'same-origin',
    });
    if (!response.ok) throw new Error(`verification URL returned HTTP ${response.status}`);
    body = JSON.parse(response.body) as { providerId?: unknown; challenge?: unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not fetch verification file';
    await db
      .update(providerOriginVerifications)
      .set({ lastError: message.slice(0, 2_000), updatedAt: new Date() })
      .where(eq(providerOriginVerifications.id, verification.id));
    throw new ValidationError(`Origin verification failed: ${message}`);
  }

  if (
    body.providerId !== provider.id ||
    typeof body.challenge !== 'string' ||
    hashChallenge(body.challenge) !== verification.challengeHash
  ) {
    const message = 'Verification file does not match this provider and challenge';
    await db
      .update(providerOriginVerifications)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(providerOriginVerifications.id, verification.id));
    throw new ValidationError(message);
  }

  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + VERIFIED_ORIGIN_TTL_MS);
  await db.transaction(async (tx) => {
    await tx
      .update(providerOriginVerifications)
      .set({ status: 'verified', verifiedAt, expiresAt, lastError: null, updatedAt: verifiedAt })
      .where(eq(providerOriginVerifications.id, verification.id));
    await tx
      .update(providers)
      .set({
        verifiedOrigin: verification.origin,
        originVerifiedAt: verifiedAt,
        trustTier: provider.trustTier === 'unverified' ? 'basic' : provider.trustTier,
        updatedAt: verifiedAt,
      })
      .where(eq(providers.id, provider.id));
  });

  return {
    id: verification.id,
    origin: verification.origin,
    status: 'verified' as const,
    expiresAt,
  };
}
