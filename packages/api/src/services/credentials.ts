import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  products,
  providerCredentials,
  providers,
  userProductCredentials,
} from '../db/schema.js';
import { decryptSecret, encryptSecret } from '../lib/secret-crypto.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import type { AuthLocation, AuthType } from '../lib/provider-import.js';

export type CredentialPayload = {
  authType: Exclude<AuthType, 'none'>;
  location: AuthLocation;
  name: string;
  value: string;
};

export async function upsertProviderCredential(
  userId: string,
  productId: string,
  payload: CredentialPayload,
) {
  const [product] = await db
    .select({
      id: products.id,
      providerId: products.providerId,
      executionConfig: products.executionConfig,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new NotFoundError('Product');

  const [provider] = await db
    .select({ id: providers.id, userId: providers.userId })
    .from(providers)
    .where(eq(providers.id, product.providerId))
    .limit(1);

  if (!provider) throw new NotFoundError('Provider');
  if (provider.userId !== userId) {
    throw new ForbiddenError('You do not own this product');
  }

  const authMode = ((product.executionConfig as { auth?: { mode?: string } } | null)?.auth?.mode ??
    'none') as string;
  if (authMode !== 'provider_managed') {
    throw new ValidationError('This product does not use provider-managed credentials');
  }

  const encrypted = encryptSecret(payload.value);
  const [existing] = await db
    .select({ id: providerCredentials.id })
    .from(providerCredentials)
    .where(and(eq(providerCredentials.providerId, provider.id), eq(providerCredentials.productId, product.id)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(providerCredentials)
      .set({
        authType: payload.authType,
        location: payload.location,
        name: payload.name,
        secretCiphertext: encrypted,
        updatedAt: new Date(),
      })
      .where(eq(providerCredentials.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(providerCredentials)
    .values({
      providerId: provider.id,
      productId: product.id,
      authType: payload.authType,
      location: payload.location,
      name: payload.name,
      secretCiphertext: encrypted,
    })
    .returning();

  return created;
}

export async function upsertUserCredential(
  userId: string,
  productId: string,
  payload: CredentialPayload,
) {
  const [product] = await db
    .select({
      id: products.id,
      executionConfig: products.executionConfig,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new NotFoundError('Product');

  const authMode = ((product.executionConfig as { auth?: { mode?: string } } | null)?.auth?.mode ??
    'none') as string;
  if (authMode !== 'buyer_supplied') {
    throw new ValidationError('This product does not use buyer-supplied credentials');
  }

  const encrypted = encryptSecret(payload.value);
  const [existing] = await db
    .select({ id: userProductCredentials.id })
    .from(userProductCredentials)
    .where(
      and(
        eq(userProductCredentials.userId, userId),
        eq(userProductCredentials.productId, productId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(userProductCredentials)
      .set({
        authType: payload.authType,
        location: payload.location,
        name: payload.name,
        secretCiphertext: encrypted,
        updatedAt: new Date(),
      })
      .where(eq(userProductCredentials.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(userProductCredentials)
    .values({
      userId,
      productId,
      authType: payload.authType,
      location: payload.location,
      name: payload.name,
      secretCiphertext: encrypted,
    })
    .returning();

  return created;
}

export async function deleteUserCredential(userId: string, productId: string) {
  await db
    .delete(userProductCredentials)
    .where(
      and(eq(userProductCredentials.userId, userId), eq(userProductCredentials.productId, productId)),
    );
}

export async function getExecutionCredential(
  userId: string,
  productId: string,
  providerId: string,
  mode: string,
): Promise<CredentialPayload | null> {
  if (mode === 'none') return null;

  if (mode === 'provider_managed') {
    const [credential] = await db
      .select()
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.providerId, providerId),
          eq(providerCredentials.productId, productId),
        ),
      )
      .limit(1);

    if (!credential) {
      throw new ValidationError('Provider credential has not been configured for this product');
    }
    if (credential.authType === 'none') {
      throw new ValidationError('Provider credential is misconfigured');
    }

    return {
      authType: credential.authType,
      location: credential.location,
      name: credential.name,
      value: decryptSecret(credential.secretCiphertext),
    };
  }

  if (mode === 'buyer_supplied') {
    const [credential] = await db
      .select()
      .from(userProductCredentials)
      .where(
        and(
          eq(userProductCredentials.userId, userId),
          eq(userProductCredentials.productId, productId),
        ),
      )
      .limit(1);

    if (!credential) {
      throw new ValidationError('A buyer credential is required before purchasing this product');
    }
    if (credential.authType === 'none') {
      throw new ValidationError('Buyer credential is misconfigured');
    }

    return {
      authType: credential.authType,
      location: credential.location,
      name: credential.name,
      value: decryptSecret(credential.secretCiphertext),
    };
  }

  return null;
}

export async function hasBuyerCredential(userId: string, productId: string) {
  const [credential] = await db
    .select({ id: userProductCredentials.id })
    .from(userProductCredentials)
    .where(
      and(
        eq(userProductCredentials.userId, userId),
        eq(userProductCredentials.productId, productId),
      ),
    )
    .limit(1);

  return Boolean(credential);
}
