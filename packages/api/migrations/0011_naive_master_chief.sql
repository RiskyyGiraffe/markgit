ALTER TYPE "public"."mkgt_product_kind" ADD VALUE 'mcp';--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD COLUMN "mcp_config" jsonb;