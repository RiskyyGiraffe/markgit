CREATE TYPE "public"."mkgt_checkout_session_status" AS ENUM('pending', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."mkgt_device_authorization_status" AS ENUM('pending', 'approved', 'denied', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."mkgt_execution_status" AS ENUM('pending', 'running', 'completed', 'failed', 'timed_out');--> statement-breakpoint
CREATE TYPE "public"."mkgt_hold_status" AS ENUM('held', 'captured', 'released');--> statement-breakpoint
CREATE TYPE "public"."mkgt_ledger_entry_type" AS ENUM('credit', 'debit', 'hold', 'capture', 'release', 'refund');--> statement-breakpoint
CREATE TYPE "public"."mkgt_payout_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mkgt_product_status" AS ENUM('draft', 'pending_review', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."mkgt_purchase_status" AS ENUM('created', 'authorized', 'running', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."mkgt_quote_status" AS ENUM('active', 'expired', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."mkgt_tool_call_request_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mkgt_trust_tier" AS ENUM('unverified', 'basic', 'verified', 'premium');--> statement-breakpoint
CREATE TYPE "public"."mkgt_wallet_status" AS ENUM('active', 'frozen', 'closed');--> statement-breakpoint
CREATE TABLE "mkgt_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"label" varchar(255),
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_limit_usd" numeric(19, 4),
	"budget_used_usd" numeric(19, 4) DEFAULT '0' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mkgt_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "mkgt_device_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_code_hash" varchar(64) NOT NULL,
	"user_code" varchar(12) NOT NULL,
	"client_name" varchar(255) DEFAULT 'Markgit CLI' NOT NULL,
	"status" "mkgt_device_authorization_status" DEFAULT 'pending' NOT NULL,
	"user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mkgt_device_authorizations_device_code_hash_unique" UNIQUE("device_code_hash"),
	CONSTRAINT "mkgt_device_authorizations_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint
CREATE TABLE "mkgt_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" "mkgt_execution_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount_usd" numeric(19, 4) NOT NULL,
	"status" "mkgt_hold_status" DEFAULT 'held' NOT NULL,
	"purchase_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"amount_usd" numeric(19, 4) NOT NULL,
	"status" "mkgt_payout_status" DEFAULT 'pending' NOT NULL,
	"chain" varchar(50),
	"tx_hash" varchar(255),
	"wallet_address" varchar(255),
	"stripe_transfer_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"status" "mkgt_product_status" DEFAULT 'draft' NOT NULL,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"execution_config" jsonb,
	"price_per_call_usd" numeric(19, 4) NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mkgt_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "mkgt_provider_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"gross_amount_usd" numeric(19, 4) NOT NULL,
	"markgit_fee_usd" numeric(19, 4) NOT NULL,
	"net_amount_usd" numeric(19, 4) NOT NULL,
	"payout_eligible_at" timestamp with time zone,
	"payout_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_provider_payout_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"chain" varchar(50) NOT NULL,
	"wallet_address" varchar(255) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"website_url" varchar(2048),
	"trust_tier" "mkgt_trust_tier" DEFAULT 'unverified' NOT NULL,
	"stripe_account_id" varchar(255),
	"stripe_account_status" varchar(50) DEFAULT 'none',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"hold_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"execution_id" uuid,
	"status" "mkgt_purchase_status" DEFAULT 'created' NOT NULL,
	"total_usd" numeric(19, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"price_usd" numeric(19, 4) NOT NULL,
	"markgit_fee_usd" numeric(19, 4) NOT NULL,
	"total_usd" numeric(19, 4) NOT NULL,
	"status" "mkgt_quote_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_stripe_checkout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"stripe_session_id" varchar(255) NOT NULL,
	"amount_usd" numeric(19, 4) NOT NULL,
	"status" "mkgt_checkout_session_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "mkgt_stripe_checkout_sessions_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "mkgt_tool_call_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"status" "mkgt_tool_call_request_status" DEFAULT 'processing' NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mkgt_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "mkgt_wallet_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"entry_type" "mkgt_ledger_entry_type" NOT NULL,
	"amount_usd" numeric(19, 4) NOT NULL,
	"balance_after_usd" numeric(19, 4) NOT NULL,
	"description" text,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(255) DEFAULT 'default' NOT NULL,
	"status" "mkgt_wallet_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "mkgt_auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "mkgt_auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mkgt_auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "mkgt_auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mkgt_api_keys" ADD CONSTRAINT "mkgt_api_keys_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_device_authorizations" ADD CONSTRAINT "mkgt_device_authorizations_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_executions" ADD CONSTRAINT "mkgt_executions_purchase_id_mkgt_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."mkgt_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_executions" ADD CONSTRAINT "mkgt_executions_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_holds" ADD CONSTRAINT "mkgt_holds_wallet_id_mkgt_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."mkgt_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_payouts" ADD CONSTRAINT "mkgt_payouts_provider_id_mkgt_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."mkgt_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD CONSTRAINT "mkgt_products_provider_id_mkgt_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."mkgt_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_provider_earnings" ADD CONSTRAINT "mkgt_provider_earnings_provider_id_mkgt_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."mkgt_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_provider_earnings" ADD CONSTRAINT "mkgt_provider_earnings_purchase_id_mkgt_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."mkgt_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_provider_earnings" ADD CONSTRAINT "mkgt_provider_earnings_payout_id_mkgt_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."mkgt_payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_provider_payout_configs" ADD CONSTRAINT "mkgt_provider_payout_configs_provider_id_mkgt_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."mkgt_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_providers" ADD CONSTRAINT "mkgt_providers_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_purchases" ADD CONSTRAINT "mkgt_purchases_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_purchases" ADD CONSTRAINT "mkgt_purchases_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_purchases" ADD CONSTRAINT "mkgt_purchases_quote_id_mkgt_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."mkgt_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_purchases" ADD CONSTRAINT "mkgt_purchases_hold_id_mkgt_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."mkgt_holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_purchases" ADD CONSTRAINT "mkgt_purchases_wallet_id_mkgt_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."mkgt_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_quotes" ADD CONSTRAINT "mkgt_quotes_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_quotes" ADD CONSTRAINT "mkgt_quotes_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_quotes" ADD CONSTRAINT "mkgt_quotes_wallet_id_mkgt_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."mkgt_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_sessions" ADD CONSTRAINT "mkgt_sessions_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_sessions" ADD CONSTRAINT "mkgt_sessions_api_key_id_mkgt_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."mkgt_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_stripe_checkout_sessions" ADD CONSTRAINT "mkgt_stripe_checkout_sessions_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_stripe_checkout_sessions" ADD CONSTRAINT "mkgt_stripe_checkout_sessions_wallet_id_mkgt_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."mkgt_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_tool_call_requests" ADD CONSTRAINT "mkgt_tool_call_requests_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_tool_call_requests" ADD CONSTRAINT "mkgt_tool_call_requests_api_key_id_mkgt_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."mkgt_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_tool_call_requests" ADD CONSTRAINT "mkgt_tool_call_requests_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_wallet_ledger_entries" ADD CONSTRAINT "mkgt_wallet_ledger_entries_wallet_id_mkgt_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."mkgt_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_wallets" ADD CONSTRAINT "mkgt_wallets_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_auth_accounts" ADD CONSTRAINT "mkgt_auth_accounts_user_id_mkgt_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_auth_sessions" ADD CONSTRAINT "mkgt_auth_sessions_user_id_mkgt_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_tool_call_requests_user_idempotency_idx" ON "mkgt_tool_call_requests" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "mkgt_auth_accounts_user_id_idx" ON "mkgt_auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mkgt_auth_sessions_user_id_idx" ON "mkgt_auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mkgt_auth_verifications_identifier_idx" ON "mkgt_auth_verifications" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "mkgt_api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_device_authorizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_executions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_holds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_payouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_provider_earnings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_provider_payout_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_providers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_stripe_checkout_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_tool_call_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_wallet_ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_auth_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_auth_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_auth_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_auth_verifications" ENABLE ROW LEVEL SECURITY;
