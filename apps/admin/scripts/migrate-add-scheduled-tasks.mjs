#!/usr/bin/env node
/**
 * One-shot migration: add ScheduledTask + ScheduledRun tables (PLANET-1460).
 * Idempotent: skips silently if tables already exist.
 *
 * Usage:
 *   cd apps/admin
 *   vercel env pull --environment=production .env.production
 *   node scripts/migrate-add-scheduled-tasks.mjs
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

function readEnv(key) {
  const env = readFileSync('.env.production', 'utf8');
  const m = env.match(new RegExp('^' + key + '=(.*)$', 'm'));
  if (!m) throw new Error('missing ' + key + ' in .env.production');
  return m[1].replace(/^"|"$/g, '');
}

const url = readEnv('TURSO_DATABASE_URL');
const authToken = readEnv('TURSO_AUTH_TOKEN');
const client = createClient({ url, authToken });

console.log('[migrate-add-scheduled-tasks] target:', url);

async function tableExists(name) {
  const r = await client.execute({
    sql: 'SELECT name FROM sqlite_master WHERE type=? AND name=?;',
    args: ['table', name],
  });
  return r.rows.length > 0;
}

if (await tableExists('ScheduledTask')) {
  console.log('[migrate-add-scheduled-tasks] ScheduledTask exists, skip.');
} else {
  await client.execute(`
    CREATE TABLE "ScheduledTask" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "appId" TEXT NOT NULL,
      "componentId" TEXT NOT NULL,
      "cron" TEXT NOT NULL,
      "enabled" INTEGER NOT NULL DEFAULT 1,
      "lastRunAt" DATETIME,
      "lastStatus" TEXT,
      "lastError" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ScheduledTask_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App" ("id") ON DELETE CASCADE,
      CONSTRAINT "ScheduledTask_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE CASCADE
    );
  `);
  await client.execute(`CREATE INDEX "ScheduledTask_appId_idx" ON "ScheduledTask"("appId");`);
  await client.execute(`CREATE INDEX "ScheduledTask_componentId_idx" ON "ScheduledTask"("componentId");`);
  console.log('[migrate-add-scheduled-tasks] created ScheduledTask');
}

if (await tableExists('ScheduledRun')) {
  console.log('[migrate-add-scheduled-tasks] ScheduledRun exists, skip.');
} else {
  await client.execute(`
    CREATE TABLE "ScheduledRun" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "scheduledTaskId" TEXT NOT NULL,
      "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" DATETIME,
      "status" TEXT NOT NULL,
      "output" TEXT,
      "error" TEXT,
      CONSTRAINT "ScheduledRun_scheduledTaskId_fkey" FOREIGN KEY ("scheduledTaskId") REFERENCES "ScheduledTask" ("id") ON DELETE CASCADE
    );
  `);
  await client.execute(`CREATE INDEX "ScheduledRun_scheduledTaskId_idx" ON "ScheduledRun"("scheduledTaskId");`);
  console.log('[migrate-add-scheduled-tasks] created ScheduledRun');
}

client.close();
console.log('[migrate-add-scheduled-tasks] done.');
