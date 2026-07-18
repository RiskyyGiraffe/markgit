CREATE TABLE "tool_spend_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	"max_per_call_usd" numeric(19, 4),
	"daily_limit_usd" numeric(19, 4),
	"monthly_limit_usd" numeric(19, 4),
	"rate_limit_per_minute" integer,
	"rate_limit_per_hour" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_spend_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"max_per_call_usd" numeric(19, 4) DEFAULT '25' NOT NULL,
	"daily_limit_usd" numeric(19, 4) DEFAULT '100' NOT NULL,
	"monthly_limit_usd" numeric(19, 4) DEFAULT '1000' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"rate_limit_per_hour" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_spend_controls_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "tool_spend_controls" ADD CONSTRAINT "tool_spend_controls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_spend_controls" ADD CONSTRAINT "tool_spend_controls_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_spend_controls" ADD CONSTRAINT "user_spend_controls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tool_spend_controls_user_product_idx" ON "tool_spend_controls" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "purchases_product_status_idx" ON "purchases" USING btree ("product_id","status");