-- Add Component.isExported flag for App-to-App invoke (PLANET-1459)
ALTER TABLE "Component" ADD COLUMN "isExported" BOOLEAN NOT NULL DEFAULT false;
