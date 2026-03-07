import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { users, apiKeys, wallets, providers, products } from './schema.js';
import { generateApiKey } from '../lib/crypto.js';

async function seed() {
  console.log('Seeding database...');

  // ── Admin user (idempotent) ───────────────────────────────────────────
  let [user] = await db
    .insert(users)
    .values({
      email: 'admin@tolty.dev',
      name: 'Admin',
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@tolty.dev'))
      .limit(1);
    console.log(`User already exists: ${user.email} (${user.id})`);
  } else {
    console.log(`Created user: ${user.email} (${user.id})`);
  }

  // ── Default wallet (idempotent) ───────────────────────────────────────
  const [existingWallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, user.id))
    .limit(1);

  if (!existingWallet) {
    const [wallet] = await db
      .insert(wallets)
      .values({ userId: user.id })
      .returning();
    console.log(`Created wallet: ${wallet.id}`);
  } else {
    console.log(`Wallet already exists: ${existingWallet.id}`);
  }

  // ── API key (only create if none exist) ───────────────────────────────
  const [existingKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .limit(1);

  if (!existingKey) {
    const { rawKey, keyHash, keyPrefix } = generateApiKey();

    await db.insert(apiKeys).values({
      userId: user.id,
      keyHash,
      keyPrefix,
      label: 'Default admin key',
      permissions: ['*'],
    });

    console.log('\n--- Save this API key (shown only once) ---');
    console.log(`API Key: ${rawKey}`);
    console.log('-------------------------------------------\n');
  } else {
    console.log('API key already exists, skipping creation.');
  }

  // ── Open-Meteo provider (idempotent) ──────────────────────────────────
  let [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.name, 'Open-Meteo'))
    .limit(1);

  if (!provider) {
    [provider] = await db
      .insert(providers)
      .values({
        userId: user.id,
        name: 'Open-Meteo',
        description: 'Free weather API — no key required',
        websiteUrl: 'https://open-meteo.com',
      })
      .returning();
    console.log(`Created provider: ${provider.name} (${provider.id})`);
  } else {
    console.log(`Provider already exists: ${provider.name} (${provider.id})`);
  }

  // ── Current Weather product (idempotent) ──────────────────────────────
  let [product] = await db
    .insert(products)
    .values({
      providerId: provider.id,
      name: 'Current Weather',
      slug: 'open-meteo-current-weather',
      description: 'Get current weather conditions for any location on Earth via Open-Meteo.',
      category: 'weather',
      status: 'active',
      pricePerCallUsd: '0.0010',
      tags: ['weather', 'forecast', 'free', 'open-meteo'],
      inputSchema: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: { type: 'number', description: 'Latitude (-90 to 90)' },
          longitude: { type: 'number', description: 'Longitude (-180 to 180)' },
        },
      },
      executionConfig: {
        type: 'http_rest',
        method: 'GET',
        baseUrl: 'https://api.open-meteo.com/v1/forecast',
        timeoutMs: 10_000,
        paramMapping: {
          latitude: { target: 'query', param: 'latitude' },
          longitude: { target: 'query', param: 'longitude' },
        },
        staticParams: [
          { target: 'query', param: 'current_weather', value: 'true' },
        ],
      },
    })
    .onConflictDoNothing()
    .returning();

  if (!product) {
    [product] = await db
      .select()
      .from(products)
      .where(eq(products.slug, 'open-meteo-current-weather'))
      .limit(1);
    console.log(`Product already exists: ${product.name} (${product.id})`);
  } else {
    console.log(`Created product: ${product.name} (${product.id})`);
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
