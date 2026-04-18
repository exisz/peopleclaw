#!/usr/bin/env node
/**
 * Idempotent Turso migration for the StepTemplate table (PLANET-917).
 *
 * Why a script: Prisma `db push` does not support libsql/Turso. We apply the
 * SQL ourselves via @libsql/client and gate every statement with IF NOT EXISTS.
 *
 * Usage: node scripts/migrate-step-templates.mjs
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) return;
  for (const p of [
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '..', '..', '.env.local'),
    resolve(__dirname, '..', '.env'),
  ]) {
    try {
      const txt = readFileSync(p, 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\n]*)"?$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {}
  }
}
loadDotEnv();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error('TURSO_DATABASE_URL missing');
  process.exit(1);
}

const db = createClient({ url, authToken });

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS StepTemplate (
    id              TEXT PRIMARY KEY,
    category        TEXT NOT NULL,
    domain          TEXT NOT NULL,
    labelI18n       TEXT NOT NULL,
    descriptionI18n TEXT NOT NULL,
    icon            TEXT NOT NULL,
    kind            TEXT NOT NULL,
    handler         TEXT NOT NULL,
    defaultConfig   TEXT NOT NULL DEFAULT '{}',
    inputSchema     TEXT NOT NULL DEFAULT '{}',
    outputSchema    TEXT NOT NULL DEFAULT '{}',
    enabled         INTEGER NOT NULL DEFAULT 1,
    builtIn         INTEGER NOT NULL DEFAULT 1,
    createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS StepTemplate_domain_category_idx ON StepTemplate(domain, category)`,
  `CREATE INDEX IF NOT EXISTS StepTemplate_enabled_idx ON StepTemplate(enabled)`,
];

async function main() {
  console.log('[migrate-step-templates] target:', url);
  for (const sql of STATEMENTS) {
    await db.execute(sql);
    console.log('  ok:', sql.split('\n')[0].trim());
  }
  // Verify
  const r = await db.execute(
    `SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name LIKE 'StepTemplate%'`,
  );
  console.log('[migrate-step-templates] objects present:');
  for (const row of r.rows) console.log('  -', row.name);
  console.log('[migrate-step-templates] DONE');
}

main().catch((e) => {
  console.error('[migrate-step-templates] FAILED:', e);
  process.exit(1);
});
