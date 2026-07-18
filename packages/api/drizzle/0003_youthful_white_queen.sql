CREATE TYPE "public"."device_authorization_status" AS ENUM('pending', 'approved', 'denied', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."tool_call_request_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "device_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_code_hash" varchar(64) NOT NULL,
	"user_code" varchar(12) NOT NULL,
	"client_name" varchar(255) DEFAULT 'Markgit CLI' NOT NULL,
	"status" "device_authorization_status" DEFAULT 'pending' NOT NULL,
	"user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_authorizations_device_code_hash_unique" UNIQUE("device_code_hash"),
	CONSTRAINT "device_authorizations_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint
CREATE TABLE "tool_call_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"status" "tool_call_request_status" DEFAULT 'processing' NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_earnings" RENAME COLUMN "tolty_fee_usd" TO "markgit_fee_usd";--> statement-breakpoint
ALTER TABLE "quotes" RENAME COLUMN "tolty_fee_usd" TO "markgit_fee_usd";--> statement-breakpoint
ALTER TABLE "device_authorizations" ADD CONSTRAINT "device_authorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_call_requests" ADD CONSTRAINT "tool_call_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_call_requests" ADD CONSTRAINT "tool_call_requests_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_call_requests" ADD CONSTRAINT "tool_call_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tool_call_requests_user_idempotency_idx" ON "tool_call_requests" USING btree ("user_id","idempotency_key");--> statement-breakpoint
UPDATE "products"
SET "execution_config" = jsonb_set("execution_config", '{protocol}', '"markgit.tool/v1"'::jsonb)
WHERE "execution_config"->>'protocol' = 'tolty.tool/v1';
