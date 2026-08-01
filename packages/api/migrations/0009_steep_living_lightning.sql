ALTER TABLE "mkgt_harness_runs" ADD COLUMN "loop_snapshot" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mkgt_harness_runs" ADD COLUMN "compaction_snapshot" jsonb NOT NULL;