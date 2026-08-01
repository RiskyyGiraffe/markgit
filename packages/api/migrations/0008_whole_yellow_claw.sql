CREATE TYPE "public"."mkgt_harness_run_status" AS ENUM('pending', 'starting', 'running', 'waiting', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mkgt_product_kind" AS ENUM('tool', 'harness');--> statement-breakpoint
CREATE TABLE "mkgt_harness_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" varchar(100) NOT NULL,
	"source" varchar(50) NOT NULL,
	"message" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_harness_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"purchase_id" uuid,
	"execution_id" uuid,
	"status" "mkgt_harness_run_status" DEFAULT 'pending' NOT NULL,
	"provider_run_id" varchar(255),
	"callback_token_hash" varchar(64) NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error_message" text,
	"access_snapshot" jsonb NOT NULL,
	"pricing_snapshot" jsonb NOT NULL,
	"compaction_count" integer DEFAULT 0 NOT NULL,
	"last_compacted_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mkgt_harness_runs_callback_token_hash_unique" UNIQUE("callback_token_hash")
);
--> statement-breakpoint
ALTER TABLE "mkgt_product_versions" ADD COLUMN "kind" "mkgt_product_kind" DEFAULT 'tool' NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD COLUMN "kind" "mkgt_product_kind" DEFAULT 'tool' NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD COLUMN "harness_config" jsonb;--> statement-breakpoint
ALTER TABLE "mkgt_harness_run_events" ADD CONSTRAINT "mkgt_harness_run_events_run_id_mkgt_harness_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."mkgt_harness_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_harness_runs" ADD CONSTRAINT "mkgt_harness_runs_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_harness_runs" ADD CONSTRAINT "mkgt_harness_runs_api_key_id_mkgt_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."mkgt_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_harness_runs" ADD CONSTRAINT "mkgt_harness_runs_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_harness_runs" ADD CONSTRAINT "mkgt_harness_runs_quote_id_mkgt_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."mkgt_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_harness_runs" ADD CONSTRAINT "mkgt_harness_runs_purchase_id_mkgt_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."mkgt_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_harness_runs" ADD CONSTRAINT "mkgt_harness_runs_execution_id_mkgt_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."mkgt_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_harness_run_events_sequence_idx" ON "mkgt_harness_run_events" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "mkgt_harness_run_events_created_idx" ON "mkgt_harness_run_events" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "mkgt_harness_runs_user_created_idx" ON "mkgt_harness_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mkgt_harness_runs_product_status_idx" ON "mkgt_harness_runs" USING btree ("product_id","status");