#!/usr/bin/env node
/**
 * One-shot migration: add App.secrets column for per-App encrypted secret storage (PLANET-1458).
 * Idempotent: skips silently if column already exists.
 *
 * Usage: APPLY against the prod Turso DB
 *   cd apps/admin
 *   vercel env pull --environment=production .env.production
 *   node scripts/migrate-add-app-secrets.mjs
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

console.log('[migrate-add-app-secrets] target:', url);

// Check if column exists
const cols = await client.execute('PRAGMA table_info("App");');
const hasSecrets = cols.rows.some(r => r.name === 'secrets');
if (hasSecrets) {
  console.log('[migrate-add-app-secrets] column already exists, no-op.');
} else {
  await client.execute('ALTER TABLE "App" ADD COLUMN "secrets" TEXT;');
  console.log('[migrate-add-app-secrets] added column App.secrets');
}
client.close();
