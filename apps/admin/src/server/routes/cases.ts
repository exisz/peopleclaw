import { Router, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { advanceCase, submitHumanStep, parseDef, resolveHandlerKey } from '../engine/executor.js';
import { handlers } from '../engine/handlers/index.js';
import { InsufficientCreditsError } from '../lib/credit-check.js';

export const casesRouter = Router();

casesRouter.use(requireAuth, requireTenant);

// POST /api/cases — create + kick off
casesRouter.post('/cases', async (req, res: Response) => {
  const r = req as unknown as TenantedRequest;
  const { workflowId, title, payload } = req.body ?? {};
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
      payload: JSON.stringify({
        product_name: '',
        price: 0,
        stock: 0,
        image_url: '',
        description: '',
        ...(payload ?? {}),
      }),
      status: 'running',
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

// PATCH /api/cases/:id/payload — update case payload fields
casesRouter.patch('/cases/:id/payload', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { fields } = req.body ?? {};
  if (!fields || typeof fields !== 'object') { res.status(400).json({ error: 'fields object required' }); return; }
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  const merged = { ...JSON.parse(c.payload || '{}'), ...fields };
  const updated = await prisma.case.update({
    where: { id: req.params.id },
    data: { payload: JSON.stringify(merged) },
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

// PLANET-1260: POST /api/cases/:id/continue — advance from waiting_review to next step
casesRouter.post('/cases/:id/continue', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  if (c.status !== 'waiting_review') {
    res.status(400).json({ error: `Case is not in waiting_review status (current: ${c.status})` });
    return;
  }
  try {
    // Set to running, then advance (which will run next step and pause again)
    await prisma.case.update({ where: { id: c.id }, data: { status: 'running' } });
    const result = await advanceCase(c.id);
    const fresh = await prisma.case.findUnique({
      where: { id: c.id },
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

// PLANET-1260: POST /api/cases/:id/run-ai — re-run AI handler for current step without advancing
casesRouter.post('/cases/:id/run-ai', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id }, include: { workflow: true } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  if (c.status !== 'waiting_review') {
    res.status(400).json({ error: `Case is not in waiting_review status (current: ${c.status})` });
    return;
  }
  if (!c.currentStepId) {
    res.status(400).json({ error: 'No current step' });
    return;
  }

  try {
    const def = parseDef(c.workflow.definition);
    const node = def.nodes.find((n) => n.id === c.currentStepId);
    if (!node) {
      res.status(400).json({ error: `Step node not found: ${c.currentStepId}` });
      return;
    }

    const handlerKey = resolveHandlerKey(node);
    const handler = handlers[handlerKey];
    if (!handler) {
      res.status(400).json({ error: `No handler for ${handlerKey}` });
      return;
    }

    const payload = JSON.parse(c.payload || '{}');
    const ctx = {
      userId: c.ownerId,
      tenantId: c.tenantId ?? '',
      caseId: c.id,
      workflowId: c.workflowId,
      stepConfig: node.config ?? {},
    };

    const result = await handler({ payload }, ctx);
    // Merge output into payload but don't advance
    const newPayload = { ...payload, ...(result.output || {}) };
    const updated = await prisma.case.update({
      where: { id: c.id },
      data: { payload: JSON.stringify(newPayload) },
    });
    res.json({ case: updated, handlerResult: result });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      res.status(402).json({ error: e.message, code: 'insufficient_credits' });
      return;
    }
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});
