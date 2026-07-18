"use server";

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, apiKeys, wallets } from "@markgit/api/db/schema";
import { generateApiKey } from "@markgit/api/lib/crypto";

const WEB_SESSION_LABEL = "__web_session__";

export async function ensureMarkgitUser(
  email: string,
  name?: string | null
): Promise<{ userId: string }> {
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email, name: name ?? undefined })
      .returning();

    await db.insert(wallets).values({ userId: user.id });
  }

  return { userId: user.id };
}

/**
 * Find-or-create a markgit user by email, provision a fresh API key,
 * and return the raw key so the caller (a Route Handler) can set the cookie.
 */
export async function ensureMarkgitUserAndKey(
  email: string,
  name?: string | null
): Promise<{ userId: string; rawKey: string }> {
  // 1. Find or create user
  const { userId } = await ensureMarkgitUser(email, name);

  // 2. Revoke any existing web session keys
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.userId, userId),
        eq(apiKeys.label, WEB_SESSION_LABEL),
        isNull(apiKeys.revokedAt)
      )
    );

  // 3. Generate fresh API key
  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  await db.insert(apiKeys).values({
    userId,
    keyHash,
    keyPrefix,
    label: WEB_SESSION_LABEL,
    permissions: [],
  });

  return { userId, rawKey };
}
