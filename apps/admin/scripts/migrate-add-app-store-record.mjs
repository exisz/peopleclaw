#!/usr/bin/env node
/**
 * One-shot migration: create AppStoreRecord table for durable per-App
 * ctx.appStore (PLANET-1577). Replaces the process-local Map backing.
 * Idempotent: skips silently if the table already exists.
 *
 * Usage: APPLY against the prod Turso DB
 *   cd apps/admin
 *   vercel env pull --environment=production .env.production
 *   node scripts/migrate-add-app-store-record.mjs
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

function readEnv(key) {
  const env = readFileSync('.env.production', 'utf8');
  const m = env.match(new RegExp('^' + key + '=(.*)$', 'm'));
  if (!m) throw new Error('missing ' + key + ' in .env.production');
  return m[1].replace(/^"|"$/g, '');
}

const url = readEnv('TURSO_DATABASE_URL');
const authToken = readEnv('TURSO_AUTH_TOKEN');
const client = createClient({ url, authToken });

console.log('[migrate-add-app-store-record] target:', url);

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='AppStoreRecord';",
);
if (tables.rows.length > 0) {
  console.log('[migrate-add-app-store-record] table already exists, no-op.');
} else {
  await client.execute(`
    CREATE TABLE "AppStoreRecord" (
      "id"         TEXT NOT NULL PRIMARY KEY,
      "tenantId"   TEXT NOT NULL,
      "appId"      TEXT NOT NULL,
      "table"      TEXT NOT NULL,
      "payload"    TEXT NOT NULL DEFAULT '{}',
      "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"  DATETIME NOT NULL
    );
  `);
  await client.execute(
    'CREATE INDEX "AppStoreRecord_appId_table_idx" ON "AppStoreRecord" ("appId", "table");',
  );
  await client.execute(
    'CREATE INDEX "AppStoreRecord_tenantId_appId_table_idx" ON "AppStoreRecord" ("tenantId", "appId", "table");',
  );
  console.log('[migrate-add-app-store-record] created AppStoreRecord table + indexes');
}
client.close();
