import { Router, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { advanceCase, submitHumanStep } from '../engine/executor.js';
import { InsufficientCreditsError } from '../lib/credit-check.js';

export const casesRouter = Router();

casesRouter.use(requireAuth, requireTenant);

// POST /api/cases — create + kick off
casesRouter.post('/cases', async (req, res: Response) => {
  const r = req as unknown as TenantedRequest;
  const { workflowId, title, payload, stepModeOverrides } = req.body ?? {};
  if (!workflowId || !title) {
    res.status(400).json({ error: 'workflowId and title required' });
    return;
  }
  const prisma = getPrisma();
  // Workflow must belong to this tenant (or be a legacy un-tenanted one — allow)
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) { res.status(404).json({ error: 'workflow not found' }); return; }
  if (wf.tenantId && wf.tenantId !== r.tenant.id) { res.status(403).json({ error: 'workflow belongs to another tenant' }); return; }

  const c = await prisma.case.create({
    data: {
      workflowId,
      ownerId: r.user.id,
      tenantId: r.tenant.id,
      title,
      payload: JSON.stringify(payload ?? {}),
      status: 'running',
      // PLANET-1251: accept optional step mode overrides on create
      stepModeOverrides: stepModeOverrides ? JSON.stringify(stepModeOverrides) : '{}',
    },
  });

  try {
    const result = await advanceCase(c.id);
    const fresh = await prisma.case.findUnique({ where: { id: c.id } });
    res.json({ case: fresh, result });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      res.status(402).json({ error: e.message, code: 'insufficient_credits' });
      return;
    }
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// GET /api/cases — list (tenant-scoped)
casesRouter.get('/cases', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const prisma = getPrisma();
  const cases = await prisma.case.findMany({
    where: { tenantId: r.tenant.id, ...(status ? { status } : {}) },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true, workflowId: true, title: true, status: true, batchId: true,
      currentStepId: true, payload: true, createdAt: true, updatedAt: true,
      tenantId: true,
    },
  });
  res.json({ cases });
});

// GET /api/cases/:id (tenant-scoped)
casesRouter.get('/cases/:id', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: { steps: { orderBy: { createdAt: 'asc' } }, workflow: true },
  });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  res.json({ case: c });
});

// DELETE /api/cases/:id (tenant-scoped)
casesRouter.delete('/cases/:id', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  // Delete steps first, then the case
  await prisma.caseStep.deleteMany({ where: { caseId: c.id } });
  await prisma.case.delete({ where: { id: c.id } });
  res.json({ ok: true });
});

// PLANET-1251: PATCH /api/cases/:id/step-modes — update step mode overrides
casesRouter.patch('/cases/:id/step-modes', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { overrides } = req.body ?? {};
  if (!overrides || typeof overrides !== 'object') {
    res.status(400).json({ error: 'overrides object required' });
    return;
  }
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id }, include: { workflow: true } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }

  // Validate keys are valid step IDs in the workflow definition
  let def: { nodes: Array<{ id: string }> } = { nodes: [] };
  try {
    def = JSON.parse(c.workflow.definition);
  } catch {}
  const validIds = new Set(def.nodes.map((n) => n.id));
  const invalidKeys = Object.keys(overrides).filter((k) => !validIds.has(k));
  if (invalidKeys.length) {
    res.status(400).json({ error: `Invalid step IDs: ${invalidKeys.join(', ')}` });
    return;
  }

  // Validate values
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== 'auto' && v !== 'human') {
      res.status(400).json({ error: `Invalid mode for ${k}: must be 'auto' or 'human'` });
      return;
    }
  }

  const updated = await prisma.case.update({
    where: { id: req.params.id },
    data: { stepModeOverrides: JSON.stringify(overrides) },
  });
  res.json({ case: updated });
});

// POST /api/cases/:id/advance
casesRouter.post('/cases/:id/advance', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { stepId, output, action } = req.body ?? {};
  if (!stepId) { res.status(400).json({ error: 'stepId required' }); return; }
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  try {
    const result = await submitHumanStep(req.params.id, stepId, output ?? {}, action);
    const fresh = await prisma.case.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { createdAt: 'asc' } } },
    });
    res.json({ case: fresh, result });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      res.status(402).json({ error: e.message, code: 'insufficient_credits' });
      return;
    }
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});
