-- PLANET-1251: Add stepModeOverrides to Case for per-case step mode toggling
-- Safe: ADD COLUMN with DEFAULT '{}', no data loss
ALTER TABLE "Case" ADD COLUMN "stepModeOverrides" TEXT NOT NULL DEFAULT '{}';
