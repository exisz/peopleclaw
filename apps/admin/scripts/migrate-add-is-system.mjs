#!/usr/bin/env node
/**
 * PLANET-1210: migrate-add-is-system.mjs
 * Idempotent: checks column existence before ALTER; safe to run multiple times.
 * Adds isSystem column to Workflow and marks starter templates.
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
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
if (!url) { console.error('TURSO_DATABASE_URL missing'); process.exit(1); }

const client = createClient({ url, authToken });

async function columnExists(table, col) {
  const r = await client.execute(`PRAGMA table_info("${table}")`);
  return r.rows.some((row) => row.name === col);
}

async function main() {
  console.log('[migrate PLANET-1210] target:', url);

  // 1. Add isSystem column if not present
  if (!(await columnExists('Workflow', 'isSystem'))) {
    console.log('+ ALTER TABLE Workflow ADD COLUMN isSystem INTEGER NOT NULL DEFAULT 0');
    await client.execute(`ALTER TABLE "Workflow" ADD COLUMN "isSystem" INTEGER NOT NULL DEFAULT 0`);
    console.log('  ✓ column added');
  } else {
    console.log('= Workflow.isSystem already exists');
  }

  // 2. Mark existing system templates
  const r = await client.execute({
    sql: `UPDATE "Workflow" SET "isSystem" = 1 WHERE (id = 'shopify-direct-listing' OR id LIKE 'shopify-direct-listing-%') AND "isSystem" = 0`,
    args: [],
  });
  console.log(`+ marked ${r.rowsAffected} existing shopify-direct-listing row(s) as isSystem=1`);

  // 3. Show state
  const rows = await client.execute(`SELECT id, name, "isSystem" FROM "Workflow" ORDER BY "isSystem" DESC, id LIMIT 30`);
  console.log('\n[migrate PLANET-1210] current workflows:');
  for (const row of rows.rows) {
    console.log(`  ${row.isSystem ? '🔒' : '  '} ${row.id} — "${row.name}"`);
  }

  console.log('\n[migrate PLANET-1210] done ✓');
}

main().catch((e) => { console.error(e); process.exit(1); });
