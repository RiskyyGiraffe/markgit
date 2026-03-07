import { randomBytes, createHash } from 'node:crypto';

const KEY_PREFIX = 'tlty_';
const KEY_BYTE_LENGTH = 32;

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const randomPart = randomBytes(KEY_BYTE_LENGTH).toString('base64url');
  const rawKey = `${KEY_PREFIX}${randomPart}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);
  return { rawKey, keyHash, keyPrefix };
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
