-- PLANET-1577: durable generic per-App ctx.appStore backing table.
-- Replaces process-local Map. Scoped by (tenantId, appId, table). Payload = JSON.

CREATE TABLE "AppStoreRecord" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "tenantId"   TEXT NOT NULL,
  "appId"      TEXT NOT NULL,
  "table"      TEXT NOT NULL,
  "payload"    TEXT NOT NULL DEFAULT '{}',
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  DATETIME NOT NULL
);

CREATE INDEX "AppStoreRecord_appId_table_idx"
  ON "AppStoreRecord" ("appId", "table");

CREATE INDEX "AppStoreRecord_tenantId_appId_table_idx"
  ON "AppStoreRecord" ("tenantId", "appId", "table");
