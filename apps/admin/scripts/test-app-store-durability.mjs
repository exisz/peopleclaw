#!/usr/bin/env node
/**
 * PLANET-1577 — focused durability check for the new AppStoreRecord-backed
 * ctx.appStore. Builds two SEPARATE appStore instances (simulating two
 * independent Vercel lambda invocations) and asserts that records inserted
 * via the first are visible to the second.
 *
 * Usage:
 *   cd apps/admin
 *   vercel env pull --environment=production .env.production  # if not done
 *   node scripts/test-app-store-durability.mjs
 *
 * Cleans up after itself by deleting the test rows it inserts.
 */
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';

config({ path: '.env.production' });

// Force the Prisma adapter into Turso mode using the prod env we just loaded.
const { getPrisma } = await import('../api-dist/server/lib/prisma.js');
const { buildAppStoreCtx } = await import('../api-dist/server/lib/appStoreCtx.js');

const TENANT = '__planet1577_test_tenant__';
const APP    = '__planet1577_test_app__'  + Date.now();

console.log('[test] tenant=', TENANT, 'app=', APP);

const prisma = getPrisma();

// --- Pass 1: insert in a fresh ctx, flush, throw ctx away.
{
  const store = await buildAppStoreCtx({ tenantId: TENANT, appId: APP });
  if (store.list('contacts').length !== 0) throw new Error('expected empty preload');
  const c1 = store.insert('contacts', { name: 'Alice', company: 'Acme' });
  const c2 = store.insert('contacts', { name: 'Bob', company: 'Globex' });
  store.insert('followups', { contactId: c1.id, type: 'call', note: 'intro' });
  if (typeof c1.id !== 'string' || !c1.id.startsWith('r_')) {
    throw new Error('insert should return synchronously with an id, got ' + JSON.stringify(c1));
  }
  if (c1.name !== 'Alice') throw new Error('insert should echo body fields');
  await store.flush();
  console.log('[test] pass-1 inserted contacts=2 followups=1');
}

// --- Pass 2: brand-new ctx (simulates a separate request/lambda).
{
  const store = await buildAppStoreCtx({ tenantId: TENANT, appId: APP });
  const contacts  = store.list('contacts');
  const followups = store.list('followups');
  if (contacts.length !== 2) {
    throw new Error('pass-2 expected 2 contacts, got ' + contacts.length);
  }
  if (followups.length !== 1) {
    throw new Error('pass-2 expected 1 followup, got ' + followups.length);
  }
  const alice = contacts.find(c => c.name === 'Alice');
  if (!alice) throw new Error('Alice missing in pass-2');
  if (alice.company !== 'Acme') throw new Error('payload not round-tripped');
  if (typeof alice.createdAt !== 'number') throw new Error('createdAt should be unix ms');
  const byId = store.getById('contacts', alice.id);
  if (!byId || byId.id !== alice.id) throw new Error('getById failed');
  const filtered = store.listWhere('contacts', r => r.company === 'Globex');
  if (filtered.length !== 1 || filtered[0].name !== 'Bob') {
    throw new Error('listWhere failed');
  }
  console.log('[test] pass-2 saw all writes from pass-1 ✓');
}

// --- Tenant isolation: a different tenant must see nothing for this appId.
{
  const store = await buildAppStoreCtx({
    tenantId: '__planet1577_other_tenant__',
    appId: APP,
  });
  if (store.list('contacts').length !== 0) {
    throw new Error('tenant isolation broken — other tenant saw contacts');
  }
  console.log('[test] tenant isolation ✓');
}

// --- Cleanup
const deleted = await prisma.appStoreRecord.deleteMany({
  where: { tenantId: TENANT, appId: APP },
});
console.log('[test] cleanup deleted', deleted.count, 'rows');

console.log('[test] PLANET-1577 durability check PASSED ✓');
process.exit(0);
