CREATE TABLE "mkgt_product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"helpful" boolean NOT NULL,
	"title" varchar(160),
	"body" text,
	"agent_name" varchar(100) NOT NULL,
	"evidence_type" varchar(32) NOT NULL,
	"evidence_id" varchar(255) NOT NULL,
	"manifest_digest" varchar(64),
	"status" varchar(32) DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkgt_product_usage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"interaction_id" varchar(255) NOT NULL,
	"agent_name" varchar(100) NOT NULL,
	"evidence_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mkgt_provider_earnings" ADD COLUMN "cash_backed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_purchases" ADD COLUMN "cash_backed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_wallet_ledger_entries" ADD COLUMN "cash_backed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_product_reviews" ADD CONSTRAINT "mkgt_product_reviews_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_product_reviews" ADD CONSTRAINT "mkgt_product_reviews_api_key_id_mkgt_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."mkgt_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_product_reviews" ADD CONSTRAINT "mkgt_product_reviews_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_product_usage_reports" ADD CONSTRAINT "mkgt_product_usage_reports_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_product_usage_reports" ADD CONSTRAINT "mkgt_product_usage_reports_api_key_id_mkgt_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."mkgt_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_product_usage_reports" ADD CONSTRAINT "mkgt_product_usage_reports_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_product_reviews_user_product_idx" ON "mkgt_product_reviews" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "mkgt_product_reviews_product_status_created_idx" ON "mkgt_product_reviews" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_product_usage_reports_identity_idx" ON "mkgt_product_usage_reports" USING btree ("user_id","product_id","interaction_id");--> statement-breakpoint
CREATE INDEX "mkgt_product_usage_reports_product_created_idx" ON "mkgt_product_usage_reports" USING btree ("product_id","created_at");--> statement-breakpoint
DELETE FROM "mkgt_product_search_embeddings" older
USING "mkgt_product_search_embeddings" newer
WHERE older."product_id" = newer."product_id"
  AND (older."updated_at", older."id") < (newer."updated_at", newer."id");--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_product_search_embeddings_product_idx" ON "mkgt_product_search_embeddings" USING btree ("product_id");
