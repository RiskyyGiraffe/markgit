import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, deviceAuthorizations } from '../db/schema.js';
import { generateApiKey } from '../lib/crypto.js';
import { CLI_PERMISSIONS } from '../lib/permissions.js';

const DEVICE_AUTH_TTL_MS = 10 * 60 * 1000;

function hashDeviceCode(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function createUserCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
}

export async function startDeviceAuthorization(clientName = 'Markgit CLI') {
  const deviceCode = randomBytes(32).toString('base64url');
  const userCode = createUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_AUTH_TTL_MS);

  await db.insert(deviceAuthorizations).values({
    deviceCodeHash: hashDeviceCode(deviceCode),
    userCode,
    clientName: clientName.slice(0, 255),
    expiresAt,
  });

  return { deviceCode, userCode, expiresAt };
}

export async function exchangeDeviceAuthorization(deviceCode: string) {
  const [authorization] = await db
    .select()
    .from(deviceAuthorizations)
    .where(eq(deviceAuthorizations.deviceCodeHash, hashDeviceCode(deviceCode)))
    .limit(1);

  if (!authorization) return { state: 'invalid' as const };
  if (authorization.expiresAt < new Date()) return { state: 'expired' as const };
  if (authorization.status === 'pending') return { state: 'pending' as const };
  if (authorization.status === 'denied') return { state: 'denied' as const };
  if (authorization.status === 'consumed') return { state: 'consumed' as const };
  if (!authorization.userId) return { state: 'invalid' as const };

  const result = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(deviceAuthorizations)
      .set({ status: 'consumed', consumedAt: new Date() })
      .where(and(
        eq(deviceAuthorizations.id, authorization.id),
        eq(deviceAuthorizations.status, 'approved'),
      ))
      .returning({ userId: deviceAuthorizations.userId });

    if (!claimed?.userId) return null;

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const [key] = await tx
      .insert(apiKeys)
      .values({
        userId: claimed.userId,
        keyHash,
        keyPrefix,
        label: authorization.clientName,
        permissions: CLI_PERMISSIONS,
      })
      .returning({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix });

    return { rawKey, key };
  });

  if (!result) return { state: 'consumed' as const };
  return { state: 'authorized' as const, ...result };
}
