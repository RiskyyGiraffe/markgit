"use server";

import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, apiKeys, wallets } from "@tolty/api/db/schema";
import { generateApiKey } from "@tolty/api/lib/crypto";

const WEB_SESSION_LABEL = "__web_session__";

/**
 * Find-or-create a Tolty user by email, provision a fresh API key,
 * and return the raw key so the caller (a Route Handler) can set the cookie.
 */
export async function ensureToltyUserAndKey(
  email: string,
  name?: string | null
): Promise<{ userId: string; rawKey: string }> {
  // 1. Find or create user
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

    // Create wallet for new user
    await db.insert(wallets).values({ userId: user.id });
  }

  // 2. Revoke any existing web session keys
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.userId, user.id),
        eq(apiKeys.label, WEB_SESSION_LABEL),
        isNull(apiKeys.revokedAt)
      )
    );

  // 3. Generate fresh API key
  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  await db.insert(apiKeys).values({
    userId: user.id,
    keyHash,
    keyPrefix,
    label: WEB_SESSION_LABEL,
    permissions: [],
  });

  return { userId: user.id, rawKey };
}
