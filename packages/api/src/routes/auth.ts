import { Hono } from 'hono';
import { db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import { generateApiKey } from '../lib/crypto.js';
import { ValidationError } from '../lib/errors.js';
import { assertCanDelegatePermissions, validateRequestedPermissions } from '../lib/permissions.js';
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

  const permissions = validateRequestedPermissions(body.permissions);
  assertCanDelegatePermissions(ctx.permissions, permissions);

  const label = body.label?.trim();
  if (label && label.length > 255) throw new ValidationError('label must be at most 255 characters');

  let budgetLimitUsd = body.budgetLimitUsd;
  if (budgetLimitUsd !== undefined) {
    const budget = Number(budgetLimitUsd);
    if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000_000) {
      throw new ValidationError('budgetLimitUsd must be between 0 and 1000000000');
    }
    budgetLimitUsd = budget.toFixed(4);
  }

  let expiresAt: Date | undefined;
  if (body.expiresInDays !== undefined) {
    if (!Number.isInteger(body.expiresInDays) || body.expiresInDays <= 0 || body.expiresInDays > 3650) {
      throw new ValidationError('expiresInDays must be an integer between 1 and 3650');
    }
    expiresAt = new Date(Date.now() + body.expiresInDays * 86400000);
  }

  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: ctx.userId,
      keyHash,
      keyPrefix,
      label,
      permissions,
      budgetLimitUsd,
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
