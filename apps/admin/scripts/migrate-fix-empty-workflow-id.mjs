#!/usr/bin/env node
/**
 * PLANET-1042 data repair: workflows created with an empty id (caused by
 * slugify stripping all non-ASCII characters from the name) get a stable
 * nanoid-based id. Idempotent — skips if no empty-id rows.
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';

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

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) { console.error('TURSO_DATABASE_URL missing'); process.exit(1); }

const db = createClient({ url, authToken });

async function main() {
  const broken = await db.execute(`SELECT id, name, tenantId FROM Workflow WHERE id = '' OR id IS NULL`);
  if (broken.rows.length === 0) {
    console.log('[migrate] no broken empty-id workflows found — nothing to do');
    return;
  }
  for (const row of broken.rows) {
    const newId = `wf-${nanoid(8)}`;
    console.log(`[migrate] renaming id='' name="${row.name}" tenantId="${row.tenantId}" → id="${newId}"`);
    // SQLite PK update: insert+delete (no direct PK UPDATE in many drivers)
    await db.batch([
      {
        sql: `INSERT INTO Workflow (id, tenantId, name, category, definition, createdAt, updatedAt)
              SELECT ?, tenantId, name, category, definition, createdAt, CURRENT_TIMESTAMP
              FROM Workflow WHERE id = ''`,
        args: [newId],
      },
      // Move any cases referencing the empty-id workflow
      {
        sql: `UPDATE "Case" SET workflowId = ? WHERE workflowId = ''`,
        args: [newId],
      },
      {
        sql: `DELETE FROM Workflow WHERE id = ''`,
        args: [],
      },
    ]);
    console.log(`[migrate] done → ${newId}`);
  }
  const total = await db.execute('SELECT COUNT(*) as cnt FROM Workflow');
  console.log(`[migrate] total workflows: ${total.rows[0][0]}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
