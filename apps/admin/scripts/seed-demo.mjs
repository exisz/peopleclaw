#!/usr/bin/env node
/**
 * Seed demo workflows + cases into the production Turso DB.
 *
 * Source data lives in `seed-demo.data.json` (one-time export of the former
 * `apps/admin/src/client/data/{workflows,cases}.ts` modules).  The frontend no
 * longer ships any mock data — production reads everything from this DB.
 *
 * - Workflows are upserted with deterministic slug ids derived from the
 *   original `id` field (already kebab-case).  The full rich UI shape
 *   (description, icon, steps, category) is stored inside `definition` JSON
 *   so the frontend can hydrate it without an additional round-trip.
 * - Cases are inserted with `INSERT OR IGNORE` so re-running the seed
 *   never overwrites real cases.  Each demo case carries `payload.demo = true`
 *   for traceability.
 * - Cases attach to the **default** tenant (slug='default') created by the
 *   P3.8 migration and to the first User in the table as ownerId.
 *
 * Usage:
 *   pnpm --filter @peopleclaw/admin db:seed
 *   # or:
 *   cd apps/admin && node scripts/seed-demo.mjs
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- env ----
function loadDotEnv() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) return;
  const candidates = [
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '..', '..', '.env.local'),
    resolve(__dirname, '..', '.env'),
  ];
  for (const p of candidates) {
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
if (!url) { console.error('TURSO_DATABASE_URL missing — run `vercel env pull` from apps/admin first'); process.exit(1); }

const db = createClient({ url, authToken });

// ---- helpers ----
function slugify(s) {
  const ascii = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (ascii && ascii.length >= 3) return ascii.slice(0, 60);
  // Fallback to deterministic hash-suffix for non-ASCII names
  return 'wf-' + crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
}

async function getOrCreateDefaultTenant() {
  const r = await db.execute({ sql: `SELECT id FROM Tenant WHERE slug = ? LIMIT 1`, args: ['default'] });
  if (r.rows.length > 0) return r.rows[0].id;
  // Defensive: P3.8 migration should have created it. Create now if missing.
  const id = 'c' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  await db.execute({
    sql: `INSERT INTO Tenant (id, name, slug, plan, credits, createdAt, updatedAt)
          VALUES (?, ?, ?, 'free', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [id, 'Default Workspace', 'default'],
  });
  console.log(`[seed] created default tenant: ${id}`);
  return id;
}

async function getFirstUserId() {
  const r = await db.execute(`SELECT id FROM User ORDER BY id ASC LIMIT 1`);
  if (r.rows.length === 0) {
    throw new Error('No User rows exist — sign in at least once before seeding cases.');
  }
  return r.rows[0].id;
}

// ---- main ----
async function main() {
  console.log('[seed] target:', url);

  const tenantId = await getOrCreateDefaultTenant();
  console.log('[seed] default tenant:', tenantId);

  // Load embedded demo data (extracted from former apps/admin/src/client/data/*.ts)
  const dataPath = resolve(__dirname, 'seed-demo.data.json');
  const { workflows, cases } = JSON.parse(readFileSync(dataPath, 'utf8'));

  // ---- WORKFLOWS ----
  const idMap = new Map(); // original id → seeded id (== slug)
  for (const w of workflows) {
    const id = slugify(w.id);
    idMap.set(w.id, id);
    // Preserve the full UI shape inside `definition` so the frontend can hydrate
    // without a separate metadata table.  Engine-level `nodes`/`edges` are kept
    // empty for these demo workflows; they're for browsing, not execution.
    const definition = {
      description: w.description,
      icon: w.icon,
      steps: w.steps,
      nodes: [],
      edges: [],
      // i18n: { en, zh } objects, used by useI18nField hook on frontend.
      // Falls back to top-level `name`/`category`/`description` if absent.
      name_i18n: w.name_i18n,
      category_i18n: w.category_i18n,
      description_i18n: w.description_i18n,
    };
    await db.execute({
      sql: `INSERT INTO Workflow (id, tenantId, name, category, definition, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              tenantId = excluded.tenantId,
              name = excluded.name,
              category = excluded.category,
              definition = excluded.definition,
              updatedAt = CURRENT_TIMESTAMP`,
      args: [id, tenantId, w.name, w.category, JSON.stringify(definition)],
    });
  }
  console.log(`[seed] upserted ${workflows.length} workflows`);

  // ---- CASES ----
  const ownerId = await getFirstUserId();
  console.log('[seed] owner user:', ownerId);

  let caseCount = 0;
  let stepCount = 0;
  for (const c of cases) {
    const workflowId = idMap.get(c.workflowId);
    if (!workflowId) {
      console.warn(`[seed] skipping case ${c.id} — unknown workflow ${c.workflowId}`);
      continue;
    }
    const caseId = slugify('demo-case-' + c.id);
    const payload = {
      demo: true,
      name: c.name,
      startedAt: c.startedAt,
      currentStepId: c.currentStepId,
      stepStatuses: c.stepStatuses,
      notes: c.notes ?? {},
    };
    // Map UI status → engine status
    const status =
      c.status === 'completed' ? 'done' :
      c.status === 'paused' ? 'waiting_human' :
      'running';

    const ins = await db.execute({
      sql: `INSERT OR IGNORE INTO "Case"
              (id, tenantId, workflowId, ownerId, title, status, currentStepId, payload, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [caseId, tenantId, workflowId, ownerId, c.name, status, c.currentStepId, JSON.stringify(payload)],
    });
    if (ins.rowsAffected > 0) caseCount += 1;

    // Insert one CaseStep per stepStatuses entry — INSERT OR IGNORE so reruns are safe
    for (const [stepKey, stepStatus] of Object.entries(c.stepStatuses)) {
      const stepRowId = slugify('demo-step-' + c.id + '-' + stepKey);
      // Map UI status → engine status
      const engineStatus =
        stepStatus === 'done' ? 'done' :
        stepStatus === 'in-progress' ? 'running' :
        stepStatus === 'blocked' ? 'waiting_human' :
        'pending';
      const note = c.notes?.[stepKey];
      const output = note ? JSON.stringify({ demo: true, note }) : '{}';
      const sIns = await db.execute({
        sql: `INSERT OR IGNORE INTO CaseStep
                (id, caseId, stepId, stepType, kind, status, input, output, error, startedAt, completedAt, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, '{}', ?, NULL, NULL, NULL, CURRENT_TIMESTAMP)`,
        args: [stepRowId, caseId, stepKey, 'demo', 'auto', engineStatus, output],
      });
      if (sIns.rowsAffected > 0) stepCount += 1;
    }
  }
  console.log(`[seed] inserted ${caseCount} new demo cases (+ ${stepCount} steps)`);

  // ---- verify ----
  const wfTotal = await db.execute(`SELECT COUNT(*) as n FROM Workflow`);
  const caseDemo = await db.execute(
    `SELECT COUNT(*) as n FROM "Case" WHERE json_extract(payload, '$.demo') IS NOT NULL`,
  );
  console.log(`[seed] verify — Workflow total: ${wfTotal.rows[0].n}, demo Cases: ${caseDemo.rows[0].n}`);
}

main().catch((e) => { console.error('[seed] FAILED:', e); process.exit(1); });
