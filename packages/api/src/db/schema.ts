import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  numeric,
  pgEnum,
  integer,
} from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────────────────────────

export const walletStatusEnum = pgEnum('wallet_status', [
  'active',
  'frozen',
  'closed',
]);

export const purchaseStatusEnum = pgEnum('purchase_status', [
  'created',
  'authorized',
  'running',
  'completed',
  'failed',
  'refunded',
]);

export const executionStatusEnum = pgEnum('execution_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'timed_out',
]);

export const holdStatusEnum = pgEnum('hold_status', [
  'held',
  'captured',
  'released',
]);

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'credit',
  'debit',
  'hold',
  'capture',
  'release',
  'refund',
]);

export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'pending_review',
  'active',
  'suspended',
  'archived',
]);

export const trustTierEnum = pgEnum('trust_tier', [
  'unverified',
  'basic',
  'verified',
  'premium',
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const importSourceTypeEnum = pgEnum('import_source_type', [
  'openapi_json',
  'openapi_yaml',
  'postman_collection',
  'html_docs',
  'unknown',
]);

export const importRunStatusEnum = pgEnum('import_run_status', [
  'created',
  'fetching',
  'parsed',
  'review_ready',
  'test_ready',
  'test_passed',
  'test_failed',
  'published',
]);

export const credentialAuthTypeEnum = pgEnum('credential_auth_type', [
  'none',
  'bearer',
  'api_key',
  'basic',
]);

export const credentialLocationEnum = pgEnum('credential_location', [
  'header',
  'query',
  'body',
]);

export const quoteStatusEnum = pgEnum('quote_status', [
  'active',
  'expired',
  'consumed',
]);

export const checkoutSessionStatusEnum = pgEnum('checkout_session_status', [
  'pending',
  'completed',
  'expired',
]);

// ── Tables ─────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
  label: varchar('label', { length: 255 }),
  permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
  budgetLimitUsd: numeric('budget_limit_usd', { precision: 19, scale: 4 }),
  budgetUsedUsd: numeric('budget_used_usd', { precision: 19, scale: 4 }).default('0').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  apiKeyId: uuid('api_key_id').notNull().references(() => apiKeys.id),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
});

export const providers = pgTable('providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  websiteUrl: varchar('website_url', { length: 2048 }),
  trustTier: trustTierEnum('trust_tier').default('unverified').notNull(),
  stripeAccountId: varchar('stripe_account_id', { length: 255 }),
  stripeAccountStatus: varchar('stripe_account_status', { length: 50 }).default('none'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  status: productStatusEnum('status').default('draft').notNull(),
  inputSchema: jsonb('input_schema').$type<Record<string, unknown>>(),
  outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(),
  executionConfig: jsonb('execution_config').$type<Record<string, unknown>>(),
  pricePerCallUsd: numeric('price_per_call_usd', { precision: 19, scale: 4 }).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const providerImportRuns = pgTable('provider_import_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  docsUrl: varchar('docs_url', { length: 2048 }).notNull(),
  baseUrl: varchar('base_url', { length: 2048 }).notNull(),
  sourceType: importSourceTypeEnum('source_type').default('unknown').notNull(),
  status: importRunStatusEnum('status').default('created').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).default('0').notNull(),
  warnings: jsonb('warnings').$type<string[]>().default([]).notNull(),
  errors: jsonb('errors').$type<string[]>().default([]).notNull(),
  generatedDraft: jsonb('generated_draft').$type<Record<string, unknown>>(),
  lastTestRequest: jsonb('last_test_request').$type<Record<string, unknown> | null>(),
  lastTestResponse: jsonb('last_test_response').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const providerCredentials = pgTable('provider_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  productId: uuid('product_id').references(() => products.id),
  authType: credentialAuthTypeEnum('auth_type').notNull(),
  location: credentialLocationEnum('location').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  secretCiphertext: text('secret_ciphertext').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userProductCredentials = pgTable('user_product_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  authType: credentialAuthTypeEnum('auth_type').notNull(),
  location: credentialLocationEnum('location').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  secretCiphertext: text('secret_ciphertext').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  label: varchar('label', { length: 255 }).default('default').notNull(),
  status: walletStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const walletLedgerEntries = pgTable('wallet_ledger_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  entryType: ledgerEntryTypeEnum('entry_type').notNull(),
  amountUsd: numeric('amount_usd', { precision: 19, scale: 4 }).notNull(),
  balanceAfterUsd: numeric('balance_after_usd', { precision: 19, scale: 4 }).notNull(),
  description: text('description'),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  priceUsd: numeric('price_usd', { precision: 19, scale: 4 }).notNull(),
  toltyFeeUsd: numeric('tolty_fee_usd', { precision: 19, scale: 4 }).notNull(),
  totalUsd: numeric('total_usd', { precision: 19, scale: 4 }).notNull(),
  status: quoteStatusEnum('status').default('active').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const holds = pgTable('holds', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  amountUsd: numeric('amount_usd', { precision: 19, scale: 4 }).notNull(),
  status: holdStatusEnum('status').default('held').notNull(),
  purchaseId: uuid('purchase_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const purchases = pgTable('purchases', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id),
  holdId: uuid('hold_id').notNull().references(() => holds.id),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  executionId: uuid('execution_id'),
  status: purchaseStatusEnum('status').default('created').notNull(),
  totalUsd: numeric('total_usd', { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const executions = pgTable('executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  purchaseId: uuid('purchase_id').notNull().references(() => purchases.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  status: executionStatusEnum('status').default('pending').notNull(),
  input: jsonb('input').$type<Record<string, unknown>>(),
  output: jsonb('output').$type<Record<string, unknown>>(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const providerEarnings = pgTable('provider_earnings', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  purchaseId: uuid('purchase_id').notNull().references(() => purchases.id),
  grossAmountUsd: numeric('gross_amount_usd', { precision: 19, scale: 4 }).notNull(),
  toltyFeeUsd: numeric('tolty_fee_usd', { precision: 19, scale: 4 }).notNull(),
  netAmountUsd: numeric('net_amount_usd', { precision: 19, scale: 4 }).notNull(),
  payoutEligibleAt: timestamp('payout_eligible_at', { withTimezone: true }),
  payoutId: uuid('payout_id').references(() => payouts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payouts = pgTable('payouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  amountUsd: numeric('amount_usd', { precision: 19, scale: 4 }).notNull(),
  status: payoutStatusEnum('status').default('pending').notNull(),
  chain: varchar('chain', { length: 50 }),
  txHash: varchar('tx_hash', { length: 255 }),
  walletAddress: varchar('wallet_address', { length: 255 }),
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
  failureCode: varchar('failure_code', { length: 255 }),
  failureMessage: text('failure_message'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  retryCount: integer('retry_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const providerPayoutConfigs = pgTable('provider_payout_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  chain: varchar('chain', { length: 50 }).notNull(),
  walletAddress: varchar('wallet_address', { length: 255 }).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stripeCheckoutSessions = pgTable('stripe_checkout_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  stripeSessionId: varchar('stripe_session_id', { length: 255 }).notNull().unique(),
  amountUsd: numeric('amount_usd', { precision: 19, scale: 4 }).notNull(),
  status: checkoutSessionStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
