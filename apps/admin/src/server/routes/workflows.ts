import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';

export const workflowsRouter = Router();

// Public list — for browsing; future: filter by tenant.
// We allow listing (a) seeded global workflows (tenantId NULL) + (b) workflows of resolved tenant if authed.
workflowsRouter.get('/workflows', async (req, res) => {
  const prisma = getPrisma();
  // Try to resolve tenant softly (no error if missing)
  let tenantId: string | null = null;
  const slug = req.header('x-tenant-slug');
  if (slug) {
    const t = await prisma.tenant.findUnique({ where: { slug } });
    tenantId = t?.id ?? null;
  }
  const where = tenantId
    ? { OR: [{ tenantId: null }, { tenantId }] }
    : { tenantId: null };
  const list = await prisma.workflow.findMany({ where, orderBy: { createdAt: 'desc' } });
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

workflowsRouter.post('/workflows', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { id, name, category, definition } = req.body ?? {};
  if (!name || !definition) { res.status(400).json({ error: 'name and definition required' }); return; }
  const prisma = getPrisma();
  // PLANET-1042: slugify may produce an empty string for non-ASCII names (e.g. Chinese).
  // Fall back to a nanoid-based slug so the id is always a non-empty valid string.
  const rawSlug = (id || slugify(name)) as string;
  const slug = rawSlug || `wf-${nanoid(8)}`;
  const existing = slug ? await prisma.workflow.findUnique({ where: { id: slug } }) : null;
  if (existing) {
    if (existing.tenantId && existing.tenantId !== r.tenant.id) {
      res.status(403).json({
        error: 'workflow id belongs to another tenant',
        code: 'WORKFLOW_SLUG_TAKEN_OTHER_TENANT',
      });
      return;
    }
    // PLANET-930: Same-tenant slug collision → explicit conflict (no silent overwrite).
    // Frontend should show inline error and let user pick a different name.
    res.status(409).json({
      error: `A workflow named "${existing.name}" already exists. Try a different name.`,
      code: 'WORKFLOW_SLUG_CONFLICT',
      conflictingSlug: slug,
      conflictingName: existing.name,
    });
    return;
  }
  const w = await prisma.workflow.create({
    data: { id: slug, tenantId: r.tenant.id, name, category, definition: JSON.stringify(definition) },
  });
  res.json({ workflow: { ...w, definition: safeParse(w.definition) } });
});

workflowsRouter.put('/workflows/:id', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { name, category, definition } = req.body ?? {};
  if (!name || !definition) { res.status(400).json({ error: 'name and definition required' }); return; }
  const prisma = getPrisma();
  const existing = await prisma.workflow.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'not found' }); return; }
  if (existing.tenantId && existing.tenantId !== r.tenant.id) {
    res.status(403).json({ error: 'workflow belongs to another tenant' });
    return;
  }
  const w = await prisma.workflow.update({
    where: { id: req.params.id },
    data: { name, category, definition: JSON.stringify(definition), tenantId: existing.tenantId ?? r.tenant.id },
  });
  res.json({ workflow: { ...w, definition: safeParse(w.definition) } });
});

workflowsRouter.delete('/workflows/:id', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const existing = await prisma.workflow.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'not found' }); return; }
  if (existing.tenantId && existing.tenantId !== r.tenant.id) {
    res.status(403).json({ error: 'workflow belongs to another tenant' });
    return;
  }
  // Refuse delete if any case still references this workflow (cascade-safe v1)
  const refCases = await prisma.case.findMany({
    where: { workflowId: req.params.id },
    select: { id: true, title: true },
  });
  if (refCases.length > 0) {
    const cases = refCases.map((c) => ({
      id: c.id,
      name: c.title,
      url: `/cases/${c.id}`,
    }));
    res.status(409).json({ error: 'workflow_in_use', cases });
    return;
  }
  await prisma.workflow.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return { nodes: [], edges: [] }; }
}
function slugify(s: string): string {
  // PLANET-1042: transliterate common CJK/non-ASCII via latin approximation,
  // then keep only url-safe chars. May still return '' for fully non-ASCII input —
  // callers must handle empty string (fall back to nanoid).
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
