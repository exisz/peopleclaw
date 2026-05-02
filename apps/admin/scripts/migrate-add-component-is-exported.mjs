#!/usr/bin/env node
/**
 * One-shot migration: add Component.isExported column for App-to-App invoke (PLANET-1459).
 * Idempotent: skips silently if column already exists.
 *
 * Usage: APPLY against the prod Turso DB
 *   cd apps/admin
 *   vercel env pull --environment=production .env.production
 *   node scripts/migrate-add-component-is-exported.mjs
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

console.log('[migrate-add-component-is-exported] target:', url);

const cols = await client.execute('PRAGMA table_info("Component");');
const has = cols.rows.some(r => r.name === 'isExported');
if (has) {
  console.log('[migrate-add-component-is-exported] column already exists, no-op.');
} else {
  await client.execute('ALTER TABLE "Component" ADD COLUMN "isExported" BOOLEAN NOT NULL DEFAULT false;');
  console.log('[migrate-add-component-is-exported] added column Component.isExported');
}
client.close();
