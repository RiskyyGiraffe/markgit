CREATE TABLE "mkgt_tool_spend_controls" (
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
CREATE TABLE "mkgt_user_spend_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"max_per_call_usd" numeric(19, 4) DEFAULT '25' NOT NULL,
	"daily_limit_usd" numeric(19, 4) DEFAULT '100' NOT NULL,
	"monthly_limit_usd" numeric(19, 4) DEFAULT '1000' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"rate_limit_per_hour" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mkgt_user_spend_controls_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "mkgt_tool_spend_controls" ADD CONSTRAINT "mkgt_tool_spend_controls_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_tool_spend_controls" ADD CONSTRAINT "mkgt_tool_spend_controls_product_id_mkgt_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."mkgt_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mkgt_user_spend_controls" ADD CONSTRAINT "mkgt_user_spend_controls_user_id_mkgt_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mkgt_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_tool_spend_controls_user_product_idx" ON "mkgt_tool_spend_controls" USING btree ("user_id","product_id");--> statement-breakpoint
ALTER TABLE "mkgt_tool_spend_controls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mkgt_user_spend_controls" ENABLE ROW LEVEL SECURITY;
