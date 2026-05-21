#!/usr/bin/env node
/**
 * One-shot migration: create ExternalAgentKey for user-owned external
 * coding-agent / M2M API keys (PLANET-1937, PLANET-1941).
 * Idempotent: skips if the table already exists.
 *
 * Usage:
 *   cd apps/admin
 *   vercel env pull --environment=production .env.production
 *   node scripts/migrate-add-external-agent-keys.mjs
 */
import { createClient } from '@libsql/client';
import { existsSync, readFileSync } from 'node:fs';

function readDotEnv(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return env;
}

const fileEnv = { ...readDotEnv('.env.local'), ...readDotEnv('.env.production') };
const url = process.env.TURSO_DATABASE_URL || fileEnv.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || fileEnv.TURSO_AUTH_TOKEN;
if (!url) throw new Error('TURSO_DATABASE_URL missing');

const client = createClient({ url, authToken });
console.log('[migrate-add-external-agent-keys] target:', url);

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='ExternalAgentKey';",
);
if (tables.rows.length > 0) {
  console.log('[migrate-add-external-agent-keys] table already exists, no-op.');
} else {
  await client.execute(`
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
  `);
  await client.execute('CREATE UNIQUE INDEX "ExternalAgentKey_prefix_key" ON "ExternalAgentKey" ("prefix");');
  await client.execute('CREATE UNIQUE INDEX "ExternalAgentKey_tokenHash_key" ON "ExternalAgentKey" ("tokenHash");');
  await client.execute('CREATE INDEX "ExternalAgentKey_tenantId_idx" ON "ExternalAgentKey" ("tenantId");');
  await client.execute('CREATE INDEX "ExternalAgentKey_appId_idx" ON "ExternalAgentKey" ("appId");');
  await client.execute('CREATE INDEX "ExternalAgentKey_tenantId_revokedAt_idx" ON "ExternalAgentKey" ("tenantId", "revokedAt");');
  console.log('[migrate-add-external-agent-keys] created ExternalAgentKey table + indexes');
}
client.close();
