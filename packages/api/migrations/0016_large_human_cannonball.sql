CREATE TABLE "mkgt_product_feedback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"harness_run_id" uuid,
	"context_id" varchar(255) NOT NULL,
	"client_event_id" varchar(255) NOT NULL,
	"sentiment" varchar(16) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mkgt_product_reviews" ADD COLUMN "feedback_context_id" varchar(255);--> statement-breakpoint
ALTER TABLE "mkgt_product_reviews" ADD COLUMN "feedback_event_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_product_reviews" ADD COLUMN "consolidated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mkgt_product_feedback_events" ADD CONSTRAINT "mkgt_product_feedback_events_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_product_feedback_events" ADD CONSTRAINT "mkgt_product_feedback_events_api_key_id_mkgt_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."mkgt_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_product_feedback_events" ADD CONSTRAINT "mkgt_product_feedback_events_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_product_feedback_events" ADD CONSTRAINT "mkgt_product_feedback_events_harness_run_id_mkgt_harness_runs_id_fk" FOREIGN KEY ("harness_run_id") REFERENCES "public"."mkgt_harness_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_product_feedback_events_identity_idx" ON "mkgt_product_feedback_events" USING btree ("user_id","product_id","context_id","client_event_id");--> statement-breakpoint
CREATE INDEX "mkgt_product_feedback_events_context_idx" ON "mkgt_product_feedback_events" USING btree ("user_id","product_id","context_id","created_at");--> statement-breakpoint
CREATE INDEX "mkgt_product_feedback_events_run_idx" ON "mkgt_product_feedback_events" USING btree ("harness_run_id","created_at");