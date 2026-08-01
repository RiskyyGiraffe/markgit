CREATE UNIQUE INDEX "mkgt_provider_earnings_purchase_idx" ON "mkgt_provider_earnings" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mkgt_purchases_quote_idx" ON "mkgt_purchases" USING btree ("quote_id");--> statement-breakpoint
UPDATE "mkgt_api_keys"
SET "permissions" = '["*"]'::jsonb
WHERE "label" = '__web_session__' AND "permissions" = '[]'::jsonb;
