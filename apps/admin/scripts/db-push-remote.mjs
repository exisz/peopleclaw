#!/usr/bin/env node
// Apply schema changes directly to remote Turso DB via libsql client.
// Idempotent: checks PRAGMA table_info before adding columns; uses CREATE TABLE IF NOT EXISTS.
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually if not already in env
if (!process.env.TURSO_DATABASE_URL) {
  // try several locations: alongside script, ../, ../../
  const candidates = [
    resolve(__dirname, '.env.local'),
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '..', '.env.local'),
    resolve(__dirname, '..', '..', '..', '.env.local'),
  ];
  let envPath = null;
  for (const p of candidates) { try { readFileSync(p, 'utf8'); envPath = p; break; } catch {} }
  if (!envPath) envPath = candidates[0];
  try {
    const txt = readFileSync(envPath, 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\n]*)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error('TURSO_DATABASE_URL missing');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function tableExists(name) {
  const r = await client.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    args: [name],
  });
  return r.rows.length > 0;
}

async function columnExists(table, col) {
  const r = await client.execute(`PRAGMA table_info("${table}")`);
  return r.rows.some((row) => row.name === col);
}

async function ensureColumn(table, col, def) {
  if (!(await columnExists(table, col))) {
    console.log(`+ ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    await client.execute(`ALTER TABLE "${table}" ADD COLUMN ${col} ${def}`);
  } else {
    console.log(`= column ${table}.${col} exists`);
  }
}

async function exec(sql) {
  console.log(sql.split('\n')[0]);
  await client.execute(sql);
}

async function main() {
  console.log('[migrate] target:', url);

  // 1. Ensure User table exists (should from P1)
  if (!(await tableExists('User'))) {
    console.log('+ CREATE TABLE User');
    await exec(`CREATE TABLE User (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logtoId TEXT NOT NULL UNIQUE,
      email TEXT,
      visits INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  }

  // 2. Add new User columns
  await ensureColumn('User', 'credits', 'INTEGER NOT NULL DEFAULT 10');
  await ensureColumn('User', 'stripeCustomerId', 'TEXT');

  // 3. Workflow
  await exec(`CREATE TABLE IF NOT EXISTS Workflow (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    definition TEXT NOT NULL DEFAULT '{}',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  // 4. Case
  await exec(`CREATE TABLE IF NOT EXISTS "Case" (
    id TEXT PRIMARY KEY,
    workflowId TEXT NOT NULL,
    ownerId INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    currentStepId TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflowId) REFERENCES Workflow(id),
    FOREIGN KEY (ownerId) REFERENCES User(id)
  )`);

  // 5. CaseStep
  await exec(`CREATE TABLE IF NOT EXISTS CaseStep (
    id TEXT PRIMARY KEY,
    caseId TEXT NOT NULL,
    stepId TEXT NOT NULL,
    stepType TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input TEXT NOT NULL DEFAULT '{}',
    output TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    startedAt DATETIME,
    completedAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (caseId) REFERENCES "Case"(id)
  )`);

  // 6. UsageLog
  await exec(`CREATE TABLE IF NOT EXISTS UsageLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    action TEXT NOT NULL,
    creditsUsed INTEGER NOT NULL DEFAULT 0,
    creditsAdded INTEGER NOT NULL DEFAULT 0,
    packId TEXT,
    amountPaid INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id)
  )`);

  // 7. Subflow execution columns on Case (PLANET-941 P3.15a)
  // A child case (spawned by a subflow step in a parent case) carries parentCaseId/parentStepId.
  // Completion of a child case advances the parent step. Status 'waiting_subflow' is added on the parent.
  await ensureColumn('Case', 'parentCaseId', 'TEXT');
  await ensureColumn('Case', 'parentStepId', 'TEXT');
  // Index for child lookup when a child case completes
  await exec(`CREATE INDEX IF NOT EXISTS Case_parentCaseId_idx ON "Case"(parentCaseId)`);

  // Verify
  const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  console.log('\n[migrate] tables now in DB:');
  for (const r of tables.rows) console.log(' -', r.name);

  console.log('\n[migrate] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
