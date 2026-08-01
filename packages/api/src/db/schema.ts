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
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type { ToolCapabilities } from '../lib/tool-policy.js';

// ── Enums ──────────────────────────────────────────────────────────────────

export const walletStatusEnum = pgEnum('mkgt_wallet_status', [
  'active',
  'frozen',
  'closed',
]);

export const purchaseStatusEnum = pgEnum('mkgt_purchase_status', [
  'created',
  'authorized',
  'running',
  'completed',
  'failed',
  'refunded',
]);

export const executionStatusEnum = pgEnum('mkgt_execution_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'timed_out',
]);

export const holdStatusEnum = pgEnum('mkgt_hold_status', [
  'held',
  'captured',
  'released',
]);

export const ledgerEntryTypeEnum = pgEnum('mkgt_ledger_entry_type', [
  'credit',
  'debit',
  'hold',
  'capture',
  'release',
  'refund',
]);

export const productStatusEnum = pgEnum('mkgt_product_status', [
  'draft',
  'pending_review',
  'active',
  'suspended',
  'archived',
]);

export const productKindEnum = pgEnum('mkgt_product_kind', [
  'tool',
  'harness',
  'mcp',
  'skill',
]);

export const harnessRunStatusEnum = pgEnum('mkgt_harness_run_status', [
  'pending',
  'starting',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
]);

export const trustTierEnum = pgEnum('mkgt_trust_tier', [
  'unverified',
  'basic',
  'verified',
  'premium',
]);

export const payoutStatusEnum = pgEnum('mkgt_payout_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const importSourceTypeEnum = pgEnum('mkgt_import_source_type', [
  'openapi_json',
  'openapi_yaml',
  'postman_collection',
  'html_docs',
  'unknown',
]);

export const importRunStatusEnum = pgEnum('mkgt_import_run_status', [
  'created',
  'fetching',
  'parsed',
  'review_ready',
  'test_ready',
  'test_passed',
  'test_failed',
  'published',
]);

export const credentialAuthTypeEnum = pgEnum('mkgt_credential_auth_type', [
  'none',
  'bearer',
  'api_key',
  'basic',
]);

export const credentialLocationEnum = pgEnum('mkgt_credential_location', [
  'header',
  'query',
  'body',
]);

export const quoteStatusEnum = pgEnum('mkgt_quote_status', [
  'active',
  'expired',
  'consumed',
]);

export const checkoutSessionStatusEnum = pgEnum('mkgt_checkout_session_status', [
  'pending',
  'completed',
  'expired',
]);

export const backgroundJobStatusEnum = pgEnum('mkgt_background_job_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

export const deviceAuthorizationStatusEnum = pgEnum('mkgt_device_authorization_status', [
  'pending',
  'approved',
  'denied',
  'consumed',
]);

export const toolCallRequestStatusEnum = pgEnum('mkgt_tool_call_request_status', [
  'processing',
  'completed',
  'failed',
]);

export const moderationStatusEnum = pgEnum('mkgt_moderation_status', [
  'clear',
  'flagged',
  'quarantined',
]);

export const originVerificationStatusEnum = pgEnum('mkgt_origin_verification_status', [
  'pending',
  'verified',
  'failed',
  'expired',
]);

// ── Tables ─────────────────────────────────────────────────────────────────

export const users = pgTable('mkgt_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable('mkgt_api_keys', {
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

export const sessions = pgTable('mkgt_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  apiKeyId: uuid('api_key_id').notNull().references(() => apiKeys.id),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deviceAuthorizations = pgTable('mkgt_device_authorizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceCodeHash: varchar('device_code_hash', { length: 64 }).notNull().unique(),
  userCode: varchar('user_code', { length: 12 }).notNull().unique(),
  clientName: varchar('client_name', { length: 255 }).default('Markgit CLI').notNull(),
  status: deviceAuthorizationStatusEnum('status').default('pending').notNull(),
  userId: uuid('user_id').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const providers = pgTable('mkgt_providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  websiteUrl: varchar('website_url', { length: 2048 }),
  trustTier: trustTierEnum('trust_tier').default('unverified').notNull(),
  verifiedOrigin: varchar('verified_origin', { length: 2048 }),
  originVerifiedAt: timestamp('origin_verified_at', { withTimezone: true }),
  stripeAccountId: varchar('stripe_account_id', { length: 255 }),
  stripeAccountStatus: varchar('stripe_account_status', { length: 50 }).default('none'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const providerOriginVerifications = pgTable('mkgt_provider_origin_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  origin: varchar('origin', { length: 2048 }).notNull(),
  challengeHash: varchar('challenge_hash', { length: 64 }).notNull(),
  status: originVerificationStatusEnum('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mkgt_provider_origin_verifications_provider_idx').on(table.providerId, table.status),
]);

export const products = pgTable('mkgt_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  logoUrl: varchar('logo_url', { length: 2048 }),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  kind: productKindEnum('kind').default('tool').notNull(),
  status: productStatusEnum('status').default('draft').notNull(),
  moderationStatus: moderationStatusEnum('moderation_status').default('clear').notNull(),
  inputSchema: jsonb('input_schema').$type<Record<string, unknown>>(),
  outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(),
  executionConfig: jsonb('execution_config').$type<Record<string, unknown>>(),
  harnessConfig: jsonb('harness_config').$type<Record<string, unknown>>(),
  mcpConfig: jsonb('mcp_config').$type<Record<string, unknown>>(),
  skillConfig: jsonb('skill_config').$type<Record<string, unknown>>(),
  sourceMetadata: jsonb('source_metadata').$type<Record<string, unknown>>(),
  capabilities: jsonb('capabilities').$type<ToolCapabilities>(),
  manifestDigest: varchar('manifest_digest', { length: 64 }),
  currentVersion: integer('current_version').default(1).notNull(),
  pricePerCallUsd: numeric('price_per_call_usd', { precision: 19, scale: 4 }).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const productVersions = pgTable('mkgt_product_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  version: integer('version').notNull(),
  manifestDigest: varchar('manifest_digest', { length: 64 }).notNull(),
  manifest: jsonb('manifest').$type<Record<string, unknown>>().notNull(),
  kind: productKindEnum('kind').default('tool').notNull(),
  capabilities: jsonb('capabilities').$type<ToolCapabilities>().notNull(),
  endpointOrigin: varchar('endpoint_origin', { length: 2048 }).notNull(),
  pricePerCallUsd: numeric('price_per_call_usd', { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mkgt_product_versions_product_version_idx').on(table.productId, table.version),
  uniqueIndex('mkgt_product_versions_product_digest_idx').on(table.productId, table.manifestDigest),
]);

export const moderationEvents = pgTable('mkgt_moderation_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  actorUserId: uuid('actor_user_id').notNull().references(() => users.id),
  previousStatus: moderationStatusEnum('previous_status').notNull(),
  nextStatus: moderationStatusEnum('next_status').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mkgt_moderation_events_product_idx').on(table.productId, table.createdAt),
]);

export const providerImportRuns = pgTable('mkgt_provider_import_runs', {
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

export const providerCredentials = pgTable('mkgt_provider_credentials', {
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

export const userProductCredentials = pgTable('mkgt_user_product_credentials', {
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

export const wallets = pgTable('mkgt_wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  label: varchar('label', { length: 255 }).default('default').notNull(),
  status: walletStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const walletLedgerEntries = pgTable('mkgt_wallet_ledger_entries', {
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

export const quotes = pgTable('mkgt_quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  priceUsd: numeric('price_usd', { precision: 19, scale: 4 }).notNull(),
  markgitFeeUsd: numeric('markgit_fee_usd', { precision: 19, scale: 4 }).notNull(),
  totalUsd: numeric('total_usd', { precision: 19, scale: 4 }).notNull(),
  manifestDigest: varchar('manifest_digest', { length: 64 }),
  policySnapshot: jsonb('policy_snapshot').$type<Record<string, unknown>>(),
  status: quoteStatusEnum('status').default('active').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const holds = pgTable('mkgt_holds', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  amountUsd: numeric('amount_usd', { precision: 19, scale: 4 }).notNull(),
  status: holdStatusEnum('status').default('held').notNull(),
  purchaseId: uuid('purchase_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const purchases = pgTable('mkgt_purchases', {
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
}, (table) => [
  uniqueIndex('mkgt_purchases_quote_idx').on(table.quoteId),
  index('mkgt_purchases_product_status_idx').on(table.productId, table.status),
]);

export const executions = pgTable('mkgt_executions', {
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

export const harnessRuns = pgTable('mkgt_harness_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  apiKeyId: uuid('api_key_id').notNull().references(() => apiKeys.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  quoteId: uuid('quote_id').references(() => quotes.id),
  purchaseId: uuid('purchase_id').references(() => purchases.id),
  executionId: uuid('execution_id').references(() => executions.id),
  status: harnessRunStatusEnum('status').default('pending').notNull(),
  providerRunId: varchar('provider_run_id', { length: 255 }),
  callbackTokenHash: varchar('callback_token_hash', { length: 64 }).notNull().unique(),
  input: jsonb('input').$type<Record<string, unknown>>().default({}).notNull(),
  output: jsonb('output').$type<Record<string, unknown>>(),
  errorMessage: text('error_message'),
  accessSnapshot: jsonb('access_snapshot').$type<Record<string, unknown>>().notNull(),
  pricingSnapshot: jsonb('pricing_snapshot').$type<Record<string, unknown>>().notNull(),
  loopSnapshot: jsonb('loop_snapshot').$type<Record<string, unknown>>().notNull(),
  compactionSnapshot: jsonb('compaction_snapshot').$type<Record<string, unknown>>().notNull(),
  compactionCount: integer('compaction_count').default(0).notNull(),
  lastCompactedAt: timestamp('last_compacted_at', { withTimezone: true }),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mkgt_harness_runs_user_created_idx').on(table.userId, table.createdAt),
  index('mkgt_harness_runs_product_status_idx').on(table.productId, table.status),
]);

export const harnessRunEvents = pgTable('mkgt_harness_run_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => harnessRuns.id),
  sequence: integer('sequence').notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  message: text('message'),
  data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mkgt_harness_run_events_sequence_idx').on(table.runId, table.sequence),
  index('mkgt_harness_run_events_created_idx').on(table.runId, table.createdAt),
]);

export const toolCallRequests = pgTable('mkgt_tool_call_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  apiKeyId: uuid('api_key_id').notNull().references(() => apiKeys.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  status: toolCallRequestStatusEnum('status').default('processing').notNull(),
  response: jsonb('response').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mkgt_tool_call_requests_user_idempotency_idx').on(table.userId, table.idempotencyKey),
]);

export const userSpendControls = pgTable('mkgt_user_spend_controls', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  maxPerCallUsd: numeric('max_per_call_usd', { precision: 19, scale: 4 }).default('25').notNull(),
  dailyLimitUsd: numeric('daily_limit_usd', { precision: 19, scale: 4 }).default('100').notNull(),
  monthlyLimitUsd: numeric('monthly_limit_usd', { precision: 19, scale: 4 }).default('1000').notNull(),
  rateLimitPerMinute: integer('rate_limit_per_minute').default(60).notNull(),
  rateLimitPerHour: integer('rate_limit_per_hour').default(1000).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const toolSpendControls = pgTable('mkgt_tool_spend_controls', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  allowed: boolean('allowed').default(true).notNull(),
  maxPerCallUsd: numeric('max_per_call_usd', { precision: 19, scale: 4 }),
  dailyLimitUsd: numeric('daily_limit_usd', { precision: 19, scale: 4 }),
  monthlyLimitUsd: numeric('monthly_limit_usd', { precision: 19, scale: 4 }),
  rateLimitPerMinute: integer('rate_limit_per_minute'),
  rateLimitPerHour: integer('rate_limit_per_hour'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mkgt_tool_spend_controls_user_product_idx').on(table.userId, table.productId),
]);

export const userToolApprovals = pgTable('mkgt_user_tool_approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  manifestDigest: varchar('manifest_digest', { length: 64 }).notNull(),
  approvalType: varchar('approval_type', { length: 50 }).default('first_use').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('mkgt_user_tool_approvals_user_product_digest_idx').on(
    table.userId,
    table.productId,
    table.manifestDigest,
  ),
]);

export const userQuicklist = pgTable('mkgt_user_quicklist', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  authorizationMode: varchar('authorization_mode', { length: 32 }).default('ask_paid').notNull(),
  authorizationManifestDigest: varchar('authorization_manifest_digest', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mkgt_user_quicklist_user_product_idx').on(table.userId, table.productId),
  index('mkgt_user_quicklist_user_updated_idx').on(table.userId, table.updatedAt),
]);

export const providerEarnings = pgTable('mkgt_provider_earnings', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  purchaseId: uuid('purchase_id').notNull().references(() => purchases.id),
  grossAmountUsd: numeric('gross_amount_usd', { precision: 19, scale: 4 }).notNull(),
  markgitFeeUsd: numeric('markgit_fee_usd', { precision: 19, scale: 4 }).notNull(),
  netAmountUsd: numeric('net_amount_usd', { precision: 19, scale: 4 }).notNull(),
  payoutEligibleAt: timestamp('payout_eligible_at', { withTimezone: true }),
  payoutId: uuid('payout_id').references(() => payouts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mkgt_provider_earnings_purchase_idx').on(table.purchaseId),
]);

export const payouts = pgTable('mkgt_payouts', {
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

export const providerPayoutConfigs = pgTable('mkgt_provider_payout_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').notNull().references(() => providers.id),
  chain: varchar('chain', { length: 50 }).notNull(),
  walletAddress: varchar('wallet_address', { length: 255 }).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const backgroundJobs = pgTable('mkgt_background_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: varchar('kind', { length: 100 }).notNull(),
  status: backgroundJobStatusEnum('status').default('pending').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
  runAt: timestamp('run_at', { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: varchar('locked_by', { length: 255 }),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(5).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const productSearchEmbeddings = pgTable('mkgt_product_search_embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  model: varchar('model', { length: 255 }).notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  sourceText: text('source_text').notNull(),
  embedding: jsonb('embedding').$type<number[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stripeCheckoutSessions = pgTable('mkgt_stripe_checkout_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  stripeSessionId: varchar('stripe_session_id', { length: 255 }).notNull().unique(),
  amountUsd: numeric('amount_usd', { precision: 19, scale: 4 }).notNull(),
  status: checkoutSessionStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
