CREATE TABLE "mkgt_user_quicklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"authorization_mode" varchar(32) DEFAULT 'ask_paid' NOT NULL,
	"authorization_manifest_digest" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mkgt_user_quicklist" ADD CONSTRAINT "mkgt_user_quicklist_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_user_quicklist" ADD CONSTRAINT "mkgt_user_quicklist_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_user_quicklist_user_product_idx" ON "mkgt_user_quicklist" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "mkgt_user_quicklist_user_updated_idx" ON "mkgt_user_quicklist" USING btree ("user_id","updated_at");