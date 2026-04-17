import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';

export const workflowsRouter = Router();

workflowsRouter.get('/workflows', async (_req, res) => {
  const prisma = getPrisma();
  const list = await prisma.workflow.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({
    workflows: list.map((w) => ({
      ...w,
      definition: safeParse(w.definition),
    })),
  });
});

workflowsRouter.get('/workflows/:id', async (req, res) => {
  const prisma = getPrisma();
  const w = await prisma.workflow.findUnique({ where: { id: req.params.id } });
  if (!w) { res.status(404).json({ error: 'not found' }); return; }
  res.json({ workflow: { ...w, definition: safeParse(w.definition) } });
});

workflowsRouter.post('/workflows', async (req, res) => {
  const { id, name, category, definition } = req.body ?? {};
  if (!name || !definition) { res.status(400).json({ error: 'name and definition required' }); return; }
  const prisma = getPrisma();
  const slug = (id || slugify(name)) as string;
  const w = await prisma.workflow.upsert({
    where: { id: slug },
    create: { id: slug, name, category, definition: JSON.stringify(definition) },
    update: { name, category, definition: JSON.stringify(definition) },
  });
  res.json({ workflow: { ...w, definition: safeParse(w.definition) } });
});

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return { nodes: [], edges: [] }; }
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
