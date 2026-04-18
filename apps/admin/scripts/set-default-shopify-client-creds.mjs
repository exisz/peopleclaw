#!/usr/bin/env node
// PLANET-916: One-shot — set client_id/client_secret on the default tenant's
// existing Shopify connection so the cron can refresh it. Run once.
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.TURSO_DATABASE_URL) {
  for (const p of [resolve(__dirname, '..', '.env.local'), resolve(__dirname, '..', '..', '..', '.env.local')]) {
    try {
      const txt = readFileSync(p, 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\n]*)"?$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
      break;
    } catch {}
  }
}

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || process.argv[2] || '';
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || process.argv[3] || '';
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Usage: SHOPIFY_CLIENT_ID=... SHOPIFY_CLIENT_SECRET=... node scripts/set-default-shopify-client-creds.mjs');
  console.error('   or: node scripts/set-default-shopify-client-creds.mjs <client_id> <client_secret>');
  process.exit(1);
}
// Token was minted earlier today; assume ~20h remaining.
const EXPIRES_HOURS = 20;

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const r = await client.execute({
  sql: `SELECT id, tenantId, config FROM Connection WHERE type='shopify'`,
  args: [],
});
console.log(`Found ${r.rows.length} shopify connection(s).`);
for (const row of r.rows) {
  const cfg = JSON.parse(String(row.config || '{}'));
  cfg.client_id = CLIENT_ID;
  cfg.client_secret = CLIENT_SECRET;
  cfg.token_expires_at = new Date(Date.now() + EXPIRES_HOURS * 3600 * 1000).toISOString();
  await client.execute({
    sql: `UPDATE Connection SET config=?, updatedAt=? WHERE id=?`,
    args: [JSON.stringify(cfg), new Date().toISOString(), String(row.id)],
  });
  console.log(`  ✓ ${row.id} (tenant ${row.tenantId}) updated; token_expires_at=${cfg.token_expires_at}`);
}
process.exit(0);
