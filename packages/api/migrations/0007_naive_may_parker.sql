CREATE TABLE "mkgt_moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"previous_status" "mkgt_moderation_status" NOT NULL,
	"next_status" "mkgt_moderation_status" NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mkgt_moderation_events" ADD CONSTRAINT "mkgt_moderation_events_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_moderation_events" ADD CONSTRAINT "mkgt_moderation_events_actor_user_id_mkgt_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mkgt_moderation_events_product_idx" ON "mkgt_moderation_events" USING btree ("product_id","created_at");