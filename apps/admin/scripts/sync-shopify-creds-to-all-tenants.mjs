#!/usr/bin/env node
/**
 * Idempotent: ensures every Shopify Connection that points at the SAME shop_domain
 * as the canonical "default tenant" connection inherits the same client_id +
 * client_secret. The next cron tick will then refresh them all to the same
 * fresh admin_token (with the new dedup logic in routes/internal.ts).
 *
 * The "canonical" connection is the default-tenant one (cmo40g04m3ah1voon) —
 * the one that already has client_id + client_secret populated.
 *
 * Run: node apps/admin/scripts/sync-shopify-creds-to-all-tenants.mjs
 */
import 'dotenv/config';
import fs from 'node:fs';
const envPath = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\n]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { getPrisma } = await import('../api-dist/server/lib/prisma.js');
const prisma = getPrisma();

const CANONICAL_TENANT = 'cmo40g04m3ah1voon';
const conns = await prisma.connection.findMany({ where: { type: 'shopify' } });
const canonical = conns.find(c => c.tenantId === CANONICAL_TENANT);
if (!canonical) {
  console.error('Canonical default-tenant Shopify connection not found.');
  process.exit(1);
}
const canonCfg = JSON.parse(canonical.config || '{}');
if (!canonCfg.client_id || !canonCfg.client_secret || !canonCfg.shop_domain) {
  console.error('Canonical connection missing client_id/client_secret/shop_domain.');
  process.exit(1);
}
console.log('Canonical:', { shop_domain: canonCfg.shop_domain, client_id: canonCfg.client_id });

let updated = 0, skipped = 0;
for (const c of conns) {
  if (c.id === canonical.id) { skipped++; continue; }
  const cfg = JSON.parse(c.config || '{}');
  // Only sync if the same shop_domain (don't accidentally overwrite an
  // unrelated shop someone might have set up).
  if (cfg.shop_domain && cfg.shop_domain !== canonCfg.shop_domain) {
    console.log('Skip (different shop_domain):', c.id, cfg.shop_domain);
    skipped++; continue;
  }
  const next = {
    ...cfg,
    shop_domain: canonCfg.shop_domain,
    client_id: canonCfg.client_id,
    client_secret: canonCfg.client_secret,
    // leave admin_token + token_expires_at alone; cron will refresh on next tick
  };
  // Idempotency check
  if (cfg.client_id === canonCfg.client_id && cfg.client_secret === canonCfg.client_secret && cfg.shop_domain === canonCfg.shop_domain) {
    console.log('Already in sync:', c.id, '(tenant', c.tenantId + ')');
    skipped++; continue;
  }
  await prisma.connection.update({ where: { id: c.id }, data: { config: JSON.stringify(next) } });
  console.log('Synced:', c.id, '(tenant', c.tenantId + ')');
  updated++;
}
console.log(`Done. updated=${updated} skipped=${skipped} total=${conns.length}`);
process.exit(0);
