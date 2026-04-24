#!/usr/bin/env node
/**
 * seed-e2e.mjs (PLANET-925 P3.16)
 *
 * Idempotent seed for canonical E2E acceptance state. Run with:
 *   pnpm --filter @peopleclaw/admin seed:e2e
 *
 * Ensures:
 *  - Logto user `demo_acceptance_test` exists (provisioned via Management M2M
 *    if LOGTO_M2M_APP_ID + LOGTO_M2M_APP_SECRET are set; otherwise placeholder
 *    logtoId `e2e:demo_acceptance_test` is used so DB seeding still succeeds).
 *    Password: DemoAccept2026!
 *  - User row in DB linked to that logtoId, email demo_acceptance_test@peopleclaw.test
 *  - Tenant `acceptance` (slug=acceptance) exists; demo user is owner.
 *  - Workflow `shopify-auto-smoketest` exists in tenant `acceptance` (3 nodes).
 *  - Workflow `shopify-product-listing-demo` exists in tenant `acceptance` (5 nodes).
 *  - 12 step templates exist (delegates to seed-step-templates.mjs which is idempotent).
 *  - Shopify Connection: copies default tenant's client_id+client_secret if present;
 *    otherwise creates an empty (disabled) Connection row that the user can fill in.
 *
 * Safe to run multiple times; uses upserts and ON CONFLICT.
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!TURSO_URL) {
  console.error('TURSO_DATABASE_URL missing');
  process.exit(1);
}
const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// ─── Constants ──────────────────────────────────────────────────────────────
const DEMO_USERNAME = 'demo_acceptance_test';
const DEMO_PASSWORD = 'DemoAccept2026!';
const DEMO_EMAIL = 'demo_acceptance_test@peopleclaw.test';
const TENANT_SLUG = 'acceptance';
const TENANT_NAME = 'Acceptance';

const LOGTO_ENDPOINT = (process.env.LOGTO_ENDPOINT || 'https://id.rollersoft.com.au').replace(/\/$/, '');
const LOGTO_M2M_APP_ID = process.env.LOGTO_M2M_APP_ID || '';
const LOGTO_M2M_APP_SECRET = process.env.LOGTO_M2M_APP_SECRET || '';

const PLACEHOLDER_LOGTO_ID = `e2e:${DEMO_USERNAME}`;

// ─── Workflow definitions (kept in sync with seed-workflows.mjs) ─────────────
const SMOKETEST_DEF = {
  nodes: [
    { id: 's1', type: 'create_case', kind: 'auto', handler: 'create_case', config: {} },
    { id: 's2', type: 'ai_description', kind: 'auto', handler: 'ai.product_description', config: {} },
    { id: 's3', type: 'shopify_upload', kind: 'auto', handler: 'shopify.list_product', config: {} },
  ],
  edges: [
    { source: 's1', target: 's2' },
    { source: 's2', target: 's3' },
  ],
};

const DEMO_DEF = {
  nodes: [
    { id: 's1', type: 'create_case', kind: 'auto', handler: 'create_case', config: { fields: ['title', 'features', 'vendor'] } },
    { id: 's2', type: 'human:review', kind: 'human', config: { prompt: 'Review the product input' } },
    { id: 's3', type: 'ai_description', kind: 'auto', handler: 'ai.product_description', config: {} },
    { id: 's4', type: 'human:approve_copy', kind: 'human', config: { prompt: 'Approve the AI-generated copy?' } },
    { id: 's5', type: 'shopify_upload', kind: 'auto', handler: 'shopify.list_product', config: {} },
  ],
  edges: [
    { source: 's1', target: 's2' },
    { source: 's2', target: 's3' },
    { source: 's3', target: 's4' },
    { source: 's4', target: 's5' },
  ],
};

// PLANET-1206 / PLANET-1107 — Shopify 直传上架工作流（批量导入专用，无 AI 步骤）
const SHOPIFY_DIRECT_LISTING_DEF = {
  steps: [
    { id: 'sl1', name: '创建 Case', type: 'create_case', kind: 'auto', handler: 'create_case', assignee: 'create_case', config: { fields: ['product_name', 'price', 'stock', 'image_url'] }, position: { x: 0, y: 0 } },
    { id: 'sl2', name: '上架到 Shopify', type: 'agent', kind: 'auto', handler: 'publish_shopify', assignee: 'publish_shopify', config: {}, position: { x: 200, y: 0 } },
  ],
  nodes: [
    { id: 'sl1', type: 'create_case', kind: 'auto', handler: 'create_case', config: { fields: ['product_name', 'price', 'stock', 'image_url'] }, position: { x: 0, y: 0 } },
    { id: 'sl2', type: 'agent', kind: 'auto', handler: 'publish_shopify', config: {}, position: { x: 200, y: 0 } },
  ],
  edges: [
    { source: 'sl1', target: 'sl2' },
  ],
};

// ─── Logto Management M2M ────────────────────────────────────────────────────
async function getLogtoMgmtToken() {
  if (!LOGTO_M2M_APP_ID || !LOGTO_M2M_APP_SECRET) return null;
  const tokenUrl = `${LOGTO_ENDPOINT}/oidc/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    resource: `${LOGTO_ENDPOINT}/api`,
    scope: 'all',
  });
  const auth = Buffer.from(`${LOGTO_M2M_APP_ID}:${LOGTO_M2M_APP_SECRET}`).toString('base64');
  const r = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Logto M2M token request failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  return j.access_token;
}

async function ensureLogtoUser() {
  const token = await getLogtoMgmtToken().catch((e) => {
    console.warn(`[logto] ${e.message}`);
    return null;
  });
  if (!token) {
    console.warn('[logto] LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET not set — using placeholder logtoId.');
    return PLACEHOLDER_LOGTO_ID;
  }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Search by username
  const searchUrl = `${LOGTO_ENDPOINT}/api/users?search.username=${encodeURIComponent(DEMO_USERNAME)}&mode=exact`;
  const sr = await fetch(searchUrl, { headers });
  if (!sr.ok) {
    console.warn(`[logto] search failed ${sr.status} — using placeholder.`);
    return PLACEHOLDER_LOGTO_ID;
  }
  const users = await sr.json();
  if (Array.isArray(users) && users.length > 0) {
    const id = users[0].id;
    console.log(`[logto] user exists: ${id}`);
    // Reset password to ensure known state
    const pwUrl = `${LOGTO_ENDPOINT}/api/users/${id}/password`;
    const pwr = await fetch(pwUrl, { method: 'PATCH', headers, body: JSON.stringify({ password: DEMO_PASSWORD }) });
    if (!pwr.ok) console.warn(`[logto] password reset failed ${pwr.status}`);
    return id;
  }

  // Create
  const createUrl = `${LOGTO_ENDPOINT}/api/users`;
  const cr = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username: DEMO_USERNAME,
      password: DEMO_PASSWORD,
      primaryEmail: DEMO_EMAIL,
      name: 'Demo Acceptance Test',
    }),
  });
  if (!cr.ok) {
    const t = await cr.text();
    console.warn(`[logto] create failed ${cr.status} ${t} — using placeholder.`);
    return PLACEHOLDER_LOGTO_ID;
  }
  const j = await cr.json();
  console.log(`[logto] user created: ${j.id}`);
  return j.id;
}

// ─── DB helpers (raw SQL via libsql; mirrors Prisma schema) ──────────────────
async function ensureUser(logtoId) {
  const existing = await db.execute({
    sql: 'SELECT id FROM User WHERE logtoId = ? LIMIT 1',
    args: [logtoId],
  });
  if (existing.rows.length > 0) {
    const id = Number(existing.rows[0].id);
    await db.execute({
      sql: 'UPDATE User SET email = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      args: [DEMO_EMAIL, id],
    });
    console.log(`[db] User exists id=${id}`);
    return id;
  }
  const ins = await db.execute({
    sql: 'INSERT INTO User (logtoId, email, visits, credits, createdAt, updatedAt) VALUES (?, ?, 1, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
    args: [logtoId, DEMO_EMAIL],
  });
  const id = Number(ins.rows[0].id);
  console.log(`[db] User created id=${id}`);
  return id;
}

function cuid() {
  // Lightweight cuid-ish; collision probability negligible for seed.
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function ensureTenant() {
  const existing = await db.execute({
    sql: 'SELECT id FROM Tenant WHERE slug = ? LIMIT 1',
    args: [TENANT_SLUG],
  });
  if (existing.rows.length > 0) {
    const id = String(existing.rows[0].id);
    console.log(`[db] Tenant exists id=${id}`);
    return id;
  }
  const id = cuid();
  await db.execute({
    sql: 'INSERT INTO Tenant (id, name, slug, plan, credits, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    args: [id, TENANT_NAME, TENANT_SLUG, 'business', 9999],
  });
  console.log(`[db] Tenant created id=${id}`);
  return id;
}

async function ensureTenantUser(tenantId, userId) {
  const existing = await db.execute({
    sql: 'SELECT id FROM TenantUser WHERE tenantId = ? AND userId = ? LIMIT 1',
    args: [tenantId, userId],
  });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE TenantUser SET role = ? WHERE id = ?',
      args: ['owner', existing.rows[0].id],
    });
    console.log('[db] TenantUser exists (role=owner)');
    return;
  }
  await db.execute({
    sql: 'INSERT INTO TenantUser (tenantId, userId, role, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
    args: [tenantId, userId, 'owner'],
  });
  console.log('[db] TenantUser created (owner)');
}

async function upsertWorkflow(id, tenantId, name, category, defObj) {
  const definition = JSON.stringify(defObj);
  await db.execute({
    sql: `INSERT INTO Workflow (id, tenantId, name, category, definition, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            tenantId = excluded.tenantId,
            name = excluded.name,
            category = excluded.category,
            definition = excluded.definition,
            updatedAt = CURRENT_TIMESTAMP`,
    args: [id, tenantId, name, category, definition],
  });
  console.log(`[db] Workflow upserted: ${id}`);
}

async function ensureShopifyConnection(tenantId) {
  // Best-effort: copy ALL creds (admin_token + shop_domain + client_id/secret) from default tenant
  let cfg = {};
  try {
    const def = await db.execute({
      sql: `SELECT c.config FROM Connection c
            JOIN Tenant t ON t.id = c.tenantId
            WHERE c.type = 'shopify' AND t.slug = 'default'
            LIMIT 1`,
      args: [],
    });
    if (def.rows.length > 0) {
      const parsed = JSON.parse(String(def.rows[0].config || '{}'));
      cfg = {
        shop_domain: parsed.shop_domain || '',
        admin_token: parsed.admin_token || '',
        client_id: parsed.client_id || '',
        client_secret: parsed.client_secret || '',
        token_expires_at: parsed.token_expires_at || '',
      };
      console.log('[db] Connection (shopify) — copied all creds from default tenant');
    }
  } catch (e) {
    console.warn(`[db] could not copy default shopify creds: ${e.message}`);
  }

  const enabled = cfg.client_id && cfg.admin_token ? 1 : 0;
  const existing = await db.execute({
    sql: 'SELECT id FROM Connection WHERE tenantId = ? AND type = ? LIMIT 1',
    args: [tenantId, 'shopify'],
  });
  if (existing.rows.length > 0) {
    // Update existing connection with latest creds
    await db.execute({
      sql: 'UPDATE Connection SET config = ?, enabled = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      args: [JSON.stringify(cfg), enabled, existing.rows[0].id],
    });
    console.log(`[db] Connection (shopify) updated id=${existing.rows[0].id} enabled=${enabled}`);
    return;
  }

  const id = cuid();
  await db.execute({
    sql: `INSERT INTO Connection (id, tenantId, type, config, enabled, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [id, tenantId, 'shopify', JSON.stringify(cfg), enabled],
  });
  console.log(`[db] Connection (shopify) created id=${id} enabled=${enabled}`);
}

async function runStepTemplatesSeed() {
  const script = resolve(__dirname, 'seed-step-templates.mjs');
  const r = spawnSync('node', [script], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    throw new Error(`seed-step-templates.mjs exited ${r.status}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══ seed-e2e (PLANET-925 P3.16) ═══');
  const logtoId = await ensureLogtoUser();
  const userId = await ensureUser(logtoId);
  const tenantId = await ensureTenant();
  await ensureTenantUser(tenantId, userId);
  await upsertWorkflow('shopify-auto-smoketest', tenantId, 'Shopify Auto Smoke Test', 'E-commerce', SMOKETEST_DEF);
  await upsertWorkflow('shopify-product-listing-demo', tenantId, 'Shopify Product Listing (PeopleClaw Demo)', 'E-commerce', DEMO_DEF);
  // PLANET-1206 / PLANET-1107: Shopify 直传上架工作流（批量导入专用，无 AI 步骤）
  await upsertWorkflow('shopify-direct-listing', tenantId, 'Shopify 商品上架（批量）', 'E-commerce', SHOPIFY_DIRECT_LISTING_DEF);
  await ensureShopifyConnection(tenantId);
  console.log('— running seed-step-templates.mjs —');
  await runStepTemplatesSeed();
  console.log('═══ seed-e2e complete ═══');
  console.log(JSON.stringify({
    logtoId,
    userId,
    tenantId,
    tenantSlug: TENANT_SLUG,
    workflows: ['shopify-auto-smoketest', 'shopify-product-listing-demo', 'shopify-direct-listing'],
  }, null, 2));
}

main().catch((e) => {
  console.error('seed-e2e failed:', e);
  process.exit(1);
});
