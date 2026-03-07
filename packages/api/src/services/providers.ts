import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { providers } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

export async function registerProvider(userId: string, data: {
  name: string;
  description?: string;
  websiteUrl?: string;
}) {
  const [provider] = await db
    .insert(providers)
    .values({
      userId,
      name: data.name,
      description: data.description,
      websiteUrl: data.websiteUrl,
    })
    .returning();

  return provider;
}

export async function getProvider(id: string) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, id))
    .limit(1);

  if (!provider) throw new NotFoundError('Provider');
  return provider;
}

export async function getProviderByUserId(userId: string) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.userId, userId))
    .limit(1);

  return provider ?? null;
}
