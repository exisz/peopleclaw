-- PLANET-1196: Add batchId to Case for fan-out batches
-- Safe: ADD COLUMN with NULL default, no data loss
ALTER TABLE "Case" ADD COLUMN "batchId" TEXT;

-- Index for batch-scoped queries (UI grouping)
CREATE INDEX IF NOT EXISTS "Case_batchId_idx" ON "Case"("batchId");
