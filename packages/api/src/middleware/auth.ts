import { createMiddleware } from 'hono/factory';
import { eq, isNull, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import { hashApiKey } from '../lib/crypto.js';
import { UnauthorizedError } from '../lib/errors.js';

export type AuthContext = {
  userId: string;
  apiKeyId: string;
  permissions: string[];
  budgetLimits: { limitUsd: string | null; usedUsd: string };
};

export const authMiddleware = createMiddleware<{
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const rawKey = header.slice(7);
  if (!rawKey.startsWith('tlty_')) {
    throw new UnauthorizedError();
  }

  const keyHash = hashApiKey(rawKey);

  const [row] = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      permissions: apiKeys.permissions,
      budgetLimitUsd: apiKeys.budgetLimitUsd,
      budgetUsedUsd: apiKeys.budgetUsedUsd,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!row) {
    throw new UnauthorizedError();
  }

  if (row.revokedAt) {
    throw new UnauthorizedError('API key has been revoked');
  }

  if (row.expiresAt && row.expiresAt < new Date()) {
    throw new UnauthorizedError('API key has expired');
  }

  c.set('auth', {
    userId: row.userId,
    apiKeyId: row.id,
    permissions: row.permissions ?? [],
    budgetLimits: {
      limitUsd: row.budgetLimitUsd,
      usedUsd: row.budgetUsedUsd,
    },
  });

  // Update last used timestamp (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .then(() => {});

  await next();
});
