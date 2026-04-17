import { Router, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { advanceCase, submitHumanStep } from '../engine/executor.js';
import { InsufficientCreditsError } from '../lib/credit-check.js';

export const casesRouter = Router();

casesRouter.use(requireAuth);

// POST /api/cases — create + kick off
casesRouter.post('/cases', async (req, res: Response) => {
  const r = req as AuthedRequest;
  const { workflowId, title, payload } = req.body ?? {};
  if (!workflowId || !title) {
    res.status(400).json({ error: 'workflowId and title required' });
    return;
  }
  const prisma = getPrisma();
  const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) { res.status(404).json({ error: 'workflow not found' }); return; }

  const c = await prisma.case.create({
    data: {
      workflowId,
      ownerId: r.user.id,
      title,
      payload: JSON.stringify(payload ?? {}),
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

// GET /api/cases — list
casesRouter.get('/cases', async (req, res) => {
  const r = req as AuthedRequest;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const prisma = getPrisma();
  const cases = await prisma.case.findMany({
    where: { ownerId: r.user.id, ...(status ? { status } : {}) },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({ cases });
});

// GET /api/cases/:id
casesRouter.get('/cases/:id', async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: { steps: { orderBy: { createdAt: 'asc' } }, workflow: true },
  });
  if (!c || c.ownerId !== r.user.id) { res.status(404).json({ error: 'not found' }); return; }
  res.json({ case: c });
});

// POST /api/cases/:id/advance
casesRouter.post('/cases/:id/advance', async (req, res) => {
  const r = req as unknown as AuthedRequest;
  const { stepId, output, action } = req.body ?? {};
  if (!stepId) { res.status(400).json({ error: 'stepId required' }); return; }
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!c || c.ownerId !== r.user.id) { res.status(404).json({ error: 'not found' }); return; }
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
