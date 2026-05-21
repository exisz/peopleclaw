-- PLANET-1937 / PLANET-1941: external coding-agent API keys.
-- Only token hashes are stored. Tokens are tenant-scoped and optionally app-scoped.

CREATE TABLE "ExternalAgentKey" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "tenantId"        TEXT NOT NULL,
  "appId"           TEXT,
  "name"            TEXT NOT NULL,
  "prefix"          TEXT NOT NULL,
  "tokenHash"       TEXT NOT NULL,
  "scopes"          TEXT NOT NULL DEFAULT '[]',
  "createdByUserId" INTEGER,
  "lastUsedAt"      DATETIME,
  "revokedAt"       DATETIME,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL,
  CONSTRAINT "ExternalAgentKey_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExternalAgentKey_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExternalAgentKey_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExternalAgentKey_prefix_key"
  ON "ExternalAgentKey" ("prefix");

CREATE UNIQUE INDEX "ExternalAgentKey_tokenHash_key"
  ON "ExternalAgentKey" ("tokenHash");

CREATE INDEX "ExternalAgentKey_tenantId_idx"
  ON "ExternalAgentKey" ("tenantId");

CREATE INDEX "ExternalAgentKey_appId_idx"
  ON "ExternalAgentKey" ("appId");

CREATE INDEX "ExternalAgentKey_tenantId_revokedAt_idx"
  ON "ExternalAgentKey" ("tenantId", "revokedAt");
