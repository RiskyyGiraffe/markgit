ALTER TYPE "public"."mkgt_product_kind" ADD VALUE 'skill';--> statement-breakpoint
ALTER TABLE "mkgt_products" ADD COLUMN "skill_config" jsonb;