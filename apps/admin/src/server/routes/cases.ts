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
  let defNodeIds: string[] = [];
  try {
    const parsed = JSON.parse(c.workflow.definition);
    if (Array.isArray(parsed.nodes) && parsed.nodes.length) {
      defNodeIds = parsed.nodes.map((n: { id: string }) => n.id);
    } else if (Array.isArray(parsed.steps) && parsed.steps.length) {
      defNodeIds = parsed.steps.map((s: { id: string }) => s.id);
    }
  } catch {}
  const validIds = new Set(defNodeIds);
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

// PLANET-1253: PATCH /api/cases/:id/payload — merge fields into case payload
casesRouter.patch('/cases/:id/payload', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { fields } = req.body ?? {};
  if (!fields || typeof fields !== 'object') {
    res.status(400).json({ error: 'fields object required' });
    return;
  }
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }

  const existing = JSON.parse(c.payload || '{}');
  const merged = { ...existing, ...fields };
  const updated = await prisma.case.update({
    where: { id: req.params.id },
    data: { payload: JSON.stringify(merged) },
    include: { steps: { orderBy: { createdAt: 'asc' } }, workflow: true },
  });
  res.json({ case: updated });
});

// PLANET-1254: POST /api/cases/:id/retreat — step back to previous node
casesRouter.post('/cases/:id/retreat', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: { workflow: true, steps: { orderBy: { createdAt: 'asc' } } },
  });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  if (!c.currentStepId) { res.status(400).json({ error: 'Case is at the beginning, cannot retreat' }); return; }

  // Parse definition to find previous node
  let def: { nodes?: Array<{ id: string; kind?: string }>; steps?: Array<{ id: string; kind?: string }>; edges: Array<{ source: string; target: string }> };
  try {
    def = JSON.parse(c.workflow.definition);
  } catch {
    res.status(400).json({ error: 'Invalid workflow definition' });
    return;
  }

  // Find the edge that targets current step — its source is the previous node
  const incomingEdge = def.edges?.find((e) => e.target === c.currentStepId);
  if (!incomingEdge) {
    res.status(400).json({ error: 'Already at first step, cannot retreat further' });
    return;
  }
  const prevNodeId = incomingEdge.source;

  // Determine the kind of the previous node
  const allNodes = (def.nodes?.length ? def.nodes : def.steps) ?? [];
  const prevNode = allNodes.find((n) => n.id === prevNodeId);
  const prevKind = prevNode?.kind || 'auto';
  const newStatus = prevKind === 'human' ? 'waiting_human' : 'running';

  // Delete the CaseStep record for the current step (so it can be re-run)
  await prisma.caseStep.deleteMany({ where: { caseId: c.id, stepId: c.currentStepId } });

  const updated = await prisma.case.update({
    where: { id: req.params.id },
    data: { currentStepId: prevNodeId, status: newStatus },
    include: { steps: { orderBy: { createdAt: 'asc' } }, workflow: true },
  });
  res.json({ case: updated });
});

// PLANET-1255: POST /api/cases/:id/retry — retry a failed case from current step
casesRouter.post('/cases/:id/retry', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!c || c.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  if (c.status !== 'failed') {
    res.status(400).json({ error: 'Only failed cases can be retried' });
    return;
  }
  if (!c.currentStepId) {
    res.status(400).json({ error: 'No current step to retry' });
    return;
  }

  // Delete the failed CaseStep so it reruns clean
  await prisma.caseStep.deleteMany({ where: { caseId: c.id, stepId: c.currentStepId } });

  // Set status to running (advanceCase will pick up from currentStepId)
  // Set currentStepId to the PREVIOUS node so advanceCase resolves the next as the current one
  let def: { edges: Array<{ source: string; target: string }> };
  try {
    def = JSON.parse((await prisma.workflow.findUnique({ where: { id: c.workflowId } }))!.definition);
  } catch {
    res.status(400).json({ error: 'Invalid workflow definition' });
    return;
  }

  // Find the node before currentStepId
  const incomingEdge = def.edges?.find((e) => e.target === c.currentStepId);
  const prevNodeId = incomingEdge?.source ?? null;

  await prisma.case.update({
    where: { id: req.params.id },
    data: { status: 'running', currentStepId: prevNodeId },
  });

  try {
    const result = await advanceCase(c.id);
    const fresh = await prisma.case.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { createdAt: 'asc' } }, workflow: true },
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
