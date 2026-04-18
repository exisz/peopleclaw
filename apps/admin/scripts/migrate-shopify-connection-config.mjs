#!/usr/bin/env node
/**
 * PLANET-916: Extend Connection.config (type=shopify) with:
 *   { shop_domain, admin_token, client_id, client_secret, token_expires_at }
 *
 * Idempotent — safe to re-run. Adds missing keys with defaults:
 *   - client_id / client_secret: '' (admin fills via UI)
 *   - token_expires_at: now + 24h if admin_token present, else ''
 *
 * Run against production Turso:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node apps/admin/scripts/migrate-shopify-connection-config.mjs
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.TURSO_DATABASE_URL) {
  for (const p of [
    resolve(__dirname, '.env.local'),
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '..', '.env.local'),
    resolve(__dirname, '..', '..', '..', '.env.local'),
  ]) {
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

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) { console.error('TURSO_DATABASE_URL missing'); process.exit(1); }

const client = createClient({ url, authToken });

const ASSUMED_TTL_SEC = 86400;

async function main() {
  const r = await client.execute({
    sql: `SELECT id, tenantId, config FROM Connection WHERE type = ?`,
    args: ['shopify'],
  });
  console.log(`Found ${r.rows.length} Shopify connection(s).`);
  let updated = 0, skipped = 0;
  for (const row of r.rows) {
    const id = String(row.id);
    const tenantId = String(row.tenantId);
    let cfg = {};
    try { cfg = JSON.parse(String(row.config || '{}')); } catch {}

    const before = JSON.stringify(cfg);
    const next = { ...cfg };
    if (typeof next.shop_domain !== 'string') next.shop_domain = String(next.shop_domain || '');
    if (typeof next.admin_token !== 'string') next.admin_token = String(next.admin_token || '');
    if (typeof next.client_id !== 'string') next.client_id = String(next.client_id || '');
    if (typeof next.client_secret !== 'string') next.client_secret = String(next.client_secret || '');
    if (typeof next.token_expires_at !== 'string' || !next.token_expires_at) {
      if (next.admin_token) {
        next.token_expires_at = new Date(Date.now() + ASSUMED_TTL_SEC * 1000).toISOString();
      } else {
        next.token_expires_at = '';
      }
    }
    const after = JSON.stringify(next);
    if (after === before) {
      skipped++;
      console.log(`  • ${id} (tenant ${tenantId}): already up-to-date`);
      continue;
    }
    await client.execute({
      sql: `UPDATE Connection SET config = ?, updatedAt = ? WHERE id = ?`,
      args: [after, new Date().toISOString(), id],
    });
    updated++;
    console.log(`  ✓ ${id} (tenant ${tenantId}): migrated → keys=${Object.keys(next).join(',')}`);
  }
  console.log(`\nDone. updated=${updated} skipped=${skipped}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
