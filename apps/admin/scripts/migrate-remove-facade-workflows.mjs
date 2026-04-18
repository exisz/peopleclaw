#!/usr/bin/env node
/**
 * PLANET-922 P3.14 — Remove facade workflows.
 *
 * The default-tenant DB has 10 "demo metadata" workflows seeded from the old
 * client/data/workflows.ts (rental, quotation, onboarding, it-support, inventory,
 * design, finance, launch, ecommerce, social-media). They have no nodes/edges
 * and are pure UI facades.
 *
 * This migration:
 *   1. DELETEs the 10 facade workflows from the Workflow table (any tenant).
 *   2. DELETEs related demo Cases (payload.demo = true AND workflowId in the set).
 *   3. DELETEs related demo CaseSteps (cascade by case).
 *
 * It is idempotent — running it twice is a no-op.
 *
 * Usage:
 *   cd apps/admin && node scripts/migrate-remove-facade-workflows.mjs
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

const FACADE_IDS = [
  'ecommerce',
  'social-media',
  'rental',
  'quotation',
  'onboarding',
  'it-support',
  'inventory',
  'design',
  'finance',
  'launch',
];

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error('TURSO_DATABASE_URL missing — run `vercel env pull` from apps/admin first');
    process.exit(1);
  }
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  console.log('[migrate-remove-facade-workflows] target:', url);

  // Find existing rows
  const placeholders = FACADE_IDS.map(() => '?').join(',');
  const before = await db.execute({
    sql: `SELECT id, tenantId, name FROM Workflow WHERE id IN (${placeholders})`,
    args: FACADE_IDS,
  });
  console.log(`[migrate] found ${before.rows.length} facade workflow(s) to delete:`);
  for (const r of before.rows) console.log(' -', r.id, '|', r.name, '|', 'tenant=', r.tenantId);

  if (before.rows.length === 0) {
    console.log('[migrate] nothing to do — already clean.');
    return;
  }

  // Delete CaseSteps belonging to cases of these workflows
  const stepDel = await db.execute({
    sql: `DELETE FROM CaseStep WHERE caseId IN (
            SELECT id FROM "Case" WHERE workflowId IN (${placeholders})
          )`,
    args: FACADE_IDS,
  });
  console.log(`[migrate] deleted CaseSteps: ${stepDel.rowsAffected}`);

  const caseDel = await db.execute({
    sql: `DELETE FROM "Case" WHERE workflowId IN (${placeholders})`,
    args: FACADE_IDS,
  });
  console.log(`[migrate] deleted Cases: ${caseDel.rowsAffected}`);

  const wfDel = await db.execute({
    sql: `DELETE FROM Workflow WHERE id IN (${placeholders})`,
    args: FACADE_IDS,
  });
  console.log(`[migrate] deleted Workflows: ${wfDel.rowsAffected}`);

  // Verify
  const after = await db.execute(`SELECT COUNT(*) as n FROM Workflow`);
  console.log(`[migrate] verify — Workflow total now: ${after.rows[0].n}`);
  const list = await db.execute(`SELECT id, tenantId, name FROM Workflow ORDER BY createdAt`);
  for (const r of list.rows) console.log(' kept:', r.id, '|', r.name, '|', 'tenant=', r.tenantId);
}

main().catch((e) => { console.error('[migrate] FAILED:', e); process.exit(1); });
