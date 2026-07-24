CREATE TYPE "public"."mkgt_background_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mkgt_credential_auth_type" AS ENUM('none', 'bearer', 'api_key', 'basic');--> statement-breakpoint
CREATE TYPE "public"."mkgt_credential_location" AS ENUM('header', 'query', 'body');--> statement-breakpoint
CREATE TYPE "public"."mkgt_import_run_status" AS ENUM('created', 'fetching', 'parsed', 'review_ready', 'test_ready', 'test_passed', 'test_failed', 'published');--> statement-breakpoint
CREATE TYPE "public"."mkgt_import_source_type" AS ENUM('openapi_json', 'openapi_yaml', 'postman_collection', 'html_docs', 'unknown');--> statement-breakpoint
CREATE TABLE "mkgt_background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(100) NOT NULL,
	"status" "mkgt_background_job_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(255),
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_product_search_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"model" varchar(255) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"source_text" text NOT NULL,
	"embedding" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"product_id" uuid,
	"auth_type" "mkgt_credential_auth_type" NOT NULL,
	"location" "mkgt_credential_location" NOT NULL,
	"name" varchar(255) NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_provider_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"docs_url" varchar(2048) NOT NULL,
	"base_url" varchar(2048) NOT NULL,
	"source_type" "mkgt_import_source_type" DEFAULT 'unknown' NOT NULL,
	"status" "mkgt_import_run_status" DEFAULT 'created' NOT NULL,
	"confidence" numeric(5, 4) DEFAULT '0' NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_draft" jsonb,
	"last_test_request" jsonb,
	"last_test_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_user_product_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"auth_type" "mkgt_credential_auth_type" NOT NULL,
	"location" "mkgt_credential_location" NOT NULL,
	"name" varchar(255) NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mkgt_payouts" ADD COLUMN "failure_code" varchar(255);--> statement-breakpoint
ALTER TABLE "mkgt_payouts" ADD COLUMN "failure_message" text;--> statement-breakpoint
ALTER TABLE "mkgt_payouts" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mkgt_payouts" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_product_search_embeddings" ADD CONSTRAINT "mkgt_product_search_embeddings_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_provider_credentials" ADD CONSTRAINT "mkgt_provider_credentials_provider_id_mkgt_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."mkgt_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_provider_credentials" ADD CONSTRAINT "mkgt_provider_credentials_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_provider_import_runs" ADD CONSTRAINT "mkgt_provider_import_runs_provider_id_mkgt_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."mkgt_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_user_product_credentials" ADD CONSTRAINT "mkgt_user_product_credentials_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_user_product_credentials" ADD CONSTRAINT "mkgt_user_product_credentials_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_background_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_product_search_embeddings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_provider_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_provider_import_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_user_product_credentials" ENABLE ROW LEVEL SECURITY;
