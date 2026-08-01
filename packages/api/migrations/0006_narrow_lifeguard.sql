CREATE TYPE "public"."mkgt_moderation_status" AS ENUM('clear', 'flagged', 'quarantined');--> statement-breakpoint
CREATE TYPE "public"."mkgt_origin_verification_status" AS ENUM('pending', 'verified', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "mkgt_product_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"manifest_digest" varchar(64) NOT NULL,
	"manifest" jsonb NOT NULL,
	"capabilities" jsonb NOT NULL,
	"endpoint_origin" varchar(2048) NOT NULL,
	"price_per_call_usd" numeric(19, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_provider_origin_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"origin" varchar(2048) NOT NULL,
	"challenge_hash" varchar(64) NOT NULL,
	"status" "mkgt_origin_verification_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_user_tool_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"manifest_digest" varchar(64) NOT NULL,
	"approval_type" varchar(50) DEFAULT 'first_use' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD COLUMN "moderation_status" "mkgt_moderation_status" DEFAULT 'clear' NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD COLUMN "capabilities" jsonb;--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD COLUMN "manifest_digest" varchar(64);--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD COLUMN "current_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_providers" ADD COLUMN "verified_origin" varchar(2048);--> statement-breakpoint
ALTER TABLE "mkgt_providers" ADD COLUMN "origin_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mkgt_quotes" ADD COLUMN "manifest_digest" varchar(64);--> statement-breakpoint
ALTER TABLE "mkgt_quotes" ADD COLUMN "policy_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "mkgt_product_versions" ADD CONSTRAINT "mkgt_product_versions_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_provider_origin_verifications" ADD CONSTRAINT "mkgt_provider_origin_verifications_provider_id_mkgt_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."mkgt_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_user_tool_approvals" ADD CONSTRAINT "mkgt_user_tool_approvals_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_user_tool_approvals" ADD CONSTRAINT "mkgt_user_tool_approvals_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_product_versions_product_version_idx" ON "mkgt_product_versions" USING btree ("product_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_product_versions_product_digest_idx" ON "mkgt_product_versions" USING btree ("product_id","manifest_digest");--> statement-breakpoint
CREATE INDEX "mkgt_provider_origin_verifications_provider_idx" ON "mkgt_provider_origin_verifications" USING btree ("provider_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_user_tool_approvals_user_product_digest_idx" ON "mkgt_user_tool_approvals" USING btree ("user_id","product_id","manifest_digest");