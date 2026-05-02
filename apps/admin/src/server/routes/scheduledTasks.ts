/**
 * App-scoped scheduled tasks (PLANET-1460).
 *
 * Endpoints:
 *   POST   /api/apps/:appId/scheduled-tasks       — create { componentId, cron }
 *   GET    /api/apps/:appId/scheduled-tasks       — list (with last 10 runs each)
 *   PATCH  /api/scheduled-tasks/:id               — { enabled?, cron? }
 *   DELETE /api/scheduled-tasks/:id
 *   POST   /api/internal/run-scheduled            — Bearer CRON_SECRET, dispatcher
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { CronExpressionParser } from 'cron-parser';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { runComponentSync, type ComponentWithApp } from '../lib/componentInvoker.js';
import { buildCallAppCtx } from '../lib/callAppCtx.js';

export const scheduledTasksRouter = Router();

const MAX_TASKS_PER_DISPATCH = 50;
const MAX_RUNS_PER_TASK = 100;

function isValidCron(expr: string): boolean {
  if (typeof expr !== 'string') return false;
  // Only standard 5-field cron (no seconds, no @aliases) — matches Vercel.
  const trimmed = expr.trim();
  if (trimmed.split(/\s+/).length !== 5) return false;
  try {
    CronExpressionParser.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

// --- CRUD: tenant-scoped ---

scheduledTasksRouter.post(
  '/apps/:appId/scheduled-tasks',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const prisma = getPrisma();
    const { componentId, cron } = req.body ?? {};
    if (typeof componentId !== 'string' || !componentId) {
      res.status(400).json({ error: 'componentId required' });
      return;
    }
    if (!isValidCron(cron)) {
      res.status(400).json({ error: 'invalid cron (need 5-field expression)' });
      return;
    }
    const app = await prisma.app.findFirst({
      where: { id: req.params.appId, tenantId: r.tenant.id },
    });
    if (!app) { res.status(404).json({ error: 'app not found' }); return; }
    const component = await prisma.component.findFirst({
      where: { id: componentId, appId: app.id },
    });
    if (!component) { res.status(404).json({ error: 'component not in app' }); return; }
    const task = await prisma.scheduledTask.create({
      data: { appId: app.id, componentId: component.id, cron: cron.trim() },
    });
    res.json({ task });
  },
);

scheduledTasksRouter.get(
  '/apps/:appId/scheduled-tasks',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const prisma = getPrisma();
    const app = await prisma.app.findFirst({
      where: { id: req.params.appId, tenantId: r.tenant.id },
    });
    if (!app) { res.status(404).json({ error: 'app not found' }); return; }
    const tasks = await prisma.scheduledTask.findMany({
      where: { appId: app.id },
      orderBy: { createdAt: 'desc' },
      include: {
        component: { select: { id: true, name: true, type: true } },
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });
    res.json({ tasks });
  },
);

async function loadOwnedTask(req: Request, r: TenantedRequest) {
  const prisma = getPrisma();
  const t = await prisma.scheduledTask.findUnique({
    where: { id: req.params.id },
    include: { app: true },
  });
  if (!t) return null;
  if (t.app.tenantId !== r.tenant.id) return null;
  return t;
}

scheduledTasksRouter.patch(
  '/scheduled-tasks/:id',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const t = await loadOwnedTask(req, r);
    if (!t) { res.status(404).json({ error: 'task not found' }); return; }
    const data: { enabled?: boolean; cron?: string } = {};
    if ('enabled' in (req.body ?? {})) {
      if (typeof req.body.enabled !== 'boolean') {
        res.status(400).json({ error: 'enabled must be boolean' });
        return;
      }
      data.enabled = req.body.enabled;
    }
    if ('cron' in (req.body ?? {})) {
      if (!isValidCron(req.body.cron)) {
        res.status(400).json({ error: 'invalid cron' });
        return;
      }
      data.cron = (req.body.cron as string).trim();
    }
    const prisma = getPrisma();
    const task = await prisma.scheduledTask.update({ where: { id: t.id }, data });
    res.json({ task });
  },
);

scheduledTasksRouter.delete(
  '/scheduled-tasks/:id',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const t = await loadOwnedTask(req, r);
    if (!t) { res.status(404).json({ error: 'task not found' }); return; }
    const prisma = getPrisma();
    await prisma.scheduledTask.delete({ where: { id: t.id } });
    res.json({ ok: true });
  },
);

// --- Dispatcher: CRON_SECRET-protected ---

function authorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const auth = req.header('authorization') || '';
  return auth === `Bearer ${secret}`;
}

/**
 * Returns true if the cron expression `expr` is "due" at minute `now`.
 * We consider "due" = the previous scheduled fire time falls within the same
 * minute as `now` (truncated to the minute). This avoids double-firing in the
 * same minute even if the dispatcher is called multiple times.
 */
function isDueAt(expr: string, now: Date): boolean {
  try {
    // Truncate `now` to start of its minute.
    const minuteStart = new Date(now);
    minuteStart.setSeconds(0, 0);
    const minuteEnd = new Date(minuteStart.getTime() + 60_000);
    // Get the most recent fire time at or before minuteEnd.
    const it = CronExpressionParser.parse(expr, {
      currentDate: new Date(minuteEnd.getTime() - 1),
    });
    const prev = it.prev();
    const prevDate = prev.toDate();
    return prevDate >= minuteStart && prevDate < minuteEnd;
  } catch {
    return false;
  }
}

async function trimRuns(prisma: ReturnType<typeof getPrisma>, taskId: string) {
  const total = await prisma.scheduledRun.count({ where: { scheduledTaskId: taskId } });
  if (total <= MAX_RUNS_PER_TASK) return;
  const excess = total - MAX_RUNS_PER_TASK;
  const old = await prisma.scheduledRun.findMany({
    where: { scheduledTaskId: taskId },
    orderBy: { startedAt: 'asc' },
    take: excess,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.scheduledRun.deleteMany({
      where: { id: { in: old.map(o => o.id) } },
    });
  }
}

async function handleDispatch(req: Request, res: Response) {
  if (!authorizedCron(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
  const prisma = getPrisma();
  const now = new Date();

  // Force=true bypasses cron-due gating (used by e2e to deterministically run).
  const force = req.query.force === '1' || req.body?.force === true;

  const candidates = await prisma.scheduledTask.findMany({
    where: { enabled: true },
    include: { component: { include: { app: true } } },
    take: 500, // cap initial pull
  });

  const due = force
    ? candidates
    : candidates.filter(c => isDueAt(c.cron, now));

  const toRun = due.slice(0, MAX_TASKS_PER_DISPATCH);
  const skipped = due.length - toRun.length;

  const results: Array<{ taskId: string; status: 'ok' | 'error'; error?: string }> = [];

  for (const task of toRun) {
    const startedAt = new Date();
    try {
      const callApp = buildCallAppCtx(task.component.app!.tenantId);
      const { result } = await runComponentSync(
        task.component as ComponentWithApp,
        {},
        { extraCtx: { callApp, input: {} } },
      );
      const finishedAt = new Date();
      let outputJson: string | null = null;
      try { outputJson = JSON.stringify(result ?? null); } catch { outputJson = null; }
      await prisma.scheduledRun.create({
        data: {
          scheduledTaskId: task.id,
          startedAt,
          finishedAt,
          status: 'ok',
          output: outputJson,
        },
      });
      await prisma.scheduledTask.update({
        where: { id: task.id },
        data: { lastRunAt: finishedAt, lastStatus: 'ok', lastError: null },
      });
      await trimRuns(prisma, task.id);
      results.push({ taskId: task.id, status: 'ok' });
    } catch (err: any) {
      const finishedAt = new Date();
      const msg = err?.message ?? String(err);
      try {
        await prisma.scheduledRun.create({
          data: {
            scheduledTaskId: task.id,
            startedAt,
            finishedAt,
            status: 'error',
            error: msg.slice(0, 4000),
          },
        });
        await prisma.scheduledTask.update({
          where: { id: task.id },
          data: { lastRunAt: finishedAt, lastStatus: 'error', lastError: msg.slice(0, 4000) },
        });
        await trimRuns(prisma, task.id);
      } catch (e) {
        // ignore secondary failure to record run
      }
      results.push({ taskId: task.id, status: 'error', error: msg });
    }
  }

  res.json({
    at: now.toISOString(),
    candidates: candidates.length,
    due: due.length,
    ran: toRun.length,
    skippedOverCap: skipped,
    results,
    force,
  });
}

scheduledTasksRouter.post('/internal/run-scheduled', handleDispatch);
scheduledTasksRouter.get('/internal/run-scheduled', handleDispatch);
