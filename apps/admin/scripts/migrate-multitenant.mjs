#!/usr/bin/env node
// Multitenant migration — idempotent.
// 1. Creates Tenant, TenantUser, Connection tables.
// 2. Adds tenantId column to Workflow, Case, UsageLog.
// 3. Creates a "default" Tenant + adds all existing Users as owners.
// 4. Backfills existing Workflow/Case/UsageLog rows with default tenantId.
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.TURSO_DATABASE_URL) {
  const candidates = [
    resolve(__dirname, '.env.local'),
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '..', '.env.local'),
    resolve(__dirname, '..', '..', '..', '.env.local'),
  ];
  for (const p of candidates) {
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

async function tableExists(name) {
  const r = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, args: [name] });
  return r.rows.length > 0;
}
function quoteTable(t) {
  const bare = t.replace(/"/g, '');
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(bare) && !/^(case|order|group|table)$/i.test(bare) ? bare : `"${bare}"`;
}
async function columnExists(table, col) {
  const bare = table.replace(/"/g, '');
  // PRAGMA table_info needs quoted form for reserved words like Case
  const r = await client.execute(`PRAGMA table_info("${bare}")`);
  return r.rows.some((row) => row.name === col);
}
async function ensureColumn(table, col, def) {
  if (!(await columnExists(table, col))) {
    const t = quoteTable(table);
    console.log(`+ ALTER TABLE ${t} ADD COLUMN ${col} ${def}`);
    await client.execute(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`);
  } else {
    console.log(`= ${table}.${col}`);
  }
}
async function exec(sql) {
  console.log('  ' + sql.split('\n')[0].trim().slice(0, 80));
  await client.execute(sql);
}

// cuid-ish — sqlite has no UUID, generate in-script
function cuid() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function main() {
  console.log('[multitenant] target:', url);

  // === New tables ===
  await exec(`CREATE TABLE IF NOT EXISTS Tenant (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free',
    credits INTEGER NOT NULL DEFAULT 20,
    stripeCustomerId TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await exec(`CREATE TABLE IF NOT EXISTS TenantUser (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES Tenant(id),
    FOREIGN KEY (userId) REFERENCES User(id)
  )`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS TenantUser_tenantId_userId_key ON TenantUser(tenantId, userId)`);

  await exec(`CREATE TABLE IF NOT EXISTS Connection (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES Tenant(id)
  )`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS Connection_tenantId_type_key ON Connection(tenantId, type)`);

  // === Add tenantId columns ===
  await ensureColumn('Workflow', 'tenantId', 'TEXT');
  await ensureColumn('"Case"', 'tenantId', 'TEXT');
  await ensureColumn('UsageLog', 'tenantId', 'TEXT');

  // === Default tenant + backfill ===
  const existing = await client.execute({ sql: `SELECT id FROM Tenant WHERE slug=?`, args: ['default'] });
  let defaultId;
  if (existing.rows.length) {
    defaultId = existing.rows[0].id;
    console.log(`= default tenant exists: ${defaultId}`);
  } else {
    defaultId = cuid();
    await client.execute({
      sql: `INSERT INTO Tenant (id, name, slug, plan, credits) VALUES (?, ?, ?, ?, ?)`,
      args: [defaultId, 'Default Workspace', 'default', 'pro', 1000],
    });
    console.log(`+ default tenant created: ${defaultId}`);
  }

  // Add ALL Users as owners of default tenant (idempotent via UNIQUE)
  const users = await client.execute(`SELECT id FROM User`);
  for (const u of users.rows) {
    const exists = await client.execute({
      sql: `SELECT id FROM TenantUser WHERE tenantId=? AND userId=?`,
      args: [defaultId, u.id],
    });
    if (!exists.rows.length) {
      await client.execute({
        sql: `INSERT INTO TenantUser (tenantId, userId, role) VALUES (?, ?, 'owner')`,
        args: [defaultId, u.id],
      });
      console.log(`  + user ${u.id} → default owner`);
    }
  }

  // Backfill tenantId on Workflow, Case, UsageLog where NULL
  for (const tbl of ['Workflow', '"Case"', 'UsageLog']) {
    const r = await client.execute({
      sql: `UPDATE ${tbl} SET tenantId=? WHERE tenantId IS NULL`,
      args: [defaultId],
    });
    console.log(`  backfill ${tbl}: ${r.rowsAffected} rows`);
  }

  // Verify
  const counts = {};
  for (const t of ['Tenant', 'TenantUser', 'Connection', 'User', 'Workflow', '"Case"', 'UsageLog']) {
    const r = await client.execute(`SELECT COUNT(*) as c FROM ${t}`);
    counts[t] = Number(r.rows[0].c);
  }
  console.log('\n[multitenant] counts:', counts);
  console.log('[multitenant] done. defaultTenantId =', defaultId);
}

main().catch((e) => { console.error(e); process.exit(1); });
