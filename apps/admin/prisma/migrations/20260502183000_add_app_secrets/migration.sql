-- Add per-App encrypted secrets storage (PLANET-1458)
ALTER TABLE "App" ADD COLUMN "secrets" TEXT;
