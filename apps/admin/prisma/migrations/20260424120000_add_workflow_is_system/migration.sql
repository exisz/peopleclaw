-- PLANET-1210: Add isSystem flag to Workflow
-- Safe: ADD COLUMN with default false, no data loss
-- Human-reviewed before apply (禁 drizzle-kit push)
ALTER TABLE "Workflow" ADD COLUMN "isSystem" INTEGER NOT NULL DEFAULT 0;

-- Mark existing starter/system workflows as isSystem=true
-- Only affects rows whose id matches the known system template pattern
UPDATE "Workflow" SET "isSystem" = 1 WHERE id = 'shopify-direct-listing'
   OR id LIKE 'shopify-direct-listing-%';
