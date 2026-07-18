import { Hono } from 'hono';
import { db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import { generateApiKey } from '../lib/crypto.js';
import { ValidationError } from '../lib/errors.js';
import type { AuthContext } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';

const auth = new Hono<{ Variables: { auth: AuthContext } }>();

auth.get('/me', async (c) => {
  const { auth: ctx } = c.var;
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  return c.json({
    user,
    apiKey: {
      id: ctx.apiKeyId,
      permissions: ctx.permissions,
      budget: ctx.budgetLimits,
    },
  });
});

auth.post('/keys', async (c) => {
  const { auth: ctx } = c.var;
  const body = await c.req.json<{
    label?: string;
    permissions?: string[];
    budgetLimitUsd?: string;
    expiresInDays?: number;
  }>();

  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  let expiresAt: Date | undefined;
  if (body.expiresInDays) {
    if (body.expiresInDays <= 0) throw new ValidationError('expiresInDays must be positive');
    expiresAt = new Date(Date.now() + body.expiresInDays * 86400000);
  }

  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: ctx.userId,
      keyHash,
      keyPrefix,
      label: body.label,
      permissions: body.permissions ?? [],
      budgetLimitUsd: body.budgetLimitUsd,
      expiresAt,
    })
    .returning({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      label: apiKeys.label,
      permissions: apiKeys.permissions,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    });

  return c.json({
    ...row,
    key: rawKey, // only returned once at creation time
  }, 201);
});

export { auth as authRoutes };
