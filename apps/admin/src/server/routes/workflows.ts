import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
// seedDefaultWorkflows import removed (PLANET-1103: auto-seed disabled)

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
  let list = await prisma.workflow.findMany({ where, orderBy: { createdAt: 'desc' } });
  // PLANET-1103: Auto-seed disabled — new tenants start with an empty workspace.
  // Users now choose workflows from the template library (/templates).
  // (PLANET-1065 auto-seed logic removed)
  res.json({
    workflows: list.map((w) => ({
      ...w,
      isSystem: w.isSystem ?? false,
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

// PLANET-1210: Three-tier workflow delete
// A. is_system=true  → 403 (never deletable)
// B. has cases, force=true  → cascade delete cases, then workflow (transaction)
// C. has cases, no force  → 409 with cases_count
// D. no cases  → delete immediately
workflowsRouter.delete('/workflows/:id', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const existing = await prisma.workflow.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'not found' }); return; }
  if (existing.tenantId && existing.tenantId !== r.tenant.id) {
    res.status(403).json({ error: 'workflow belongs to another tenant' });
    return;
  }
  // Tier C: system template — hard block
  if (existing.isSystem) {
    res.status(403).json({ error: 'system_template', message: '系统模板不可删除' });
    return;
  }
  const force = req.query.force === 'true' || req.body?.force === true;
  const refCases = await prisma.case.findMany({
    where: { workflowId: req.params.id },
    select: { id: true },
  });
  if (refCases.length > 0 && !force) {
    // Tier B without force — return count for confirmation dialog
    res.status(409).json({
      error: 'workflow_in_use',
      cases_count: refCases.length,
      message: `此工作流有 ${refCases.length} 个关联案例，请确认是否一并删除`,
    });
    return;
  }
  if (refCases.length > 0 && force) {
    // Tier B with force — cascade delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete child cases first (subflow children), then case steps, then cases, then workflow
      const caseIds = refCases.map((c) => c.id);
      // Also get any child cases
      const childCases = await tx.case.findMany({
        where: { parentCaseId: { in: caseIds } },
        select: { id: true },
      });
      const allCaseIds = [...caseIds, ...childCases.map((c) => c.id)];
      await tx.caseStep.deleteMany({ where: { caseId: { in: allCaseIds } } });
      await tx.case.deleteMany({ where: { id: { in: allCaseIds } } });
      await tx.workflow.delete({ where: { id: req.params.id } });
    });
    res.json({ ok: true, deleted_cases: refCases.length });
    return;
  }
  // Tier A: no cases, delete directly
  await prisma.workflow.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// PLANET-1210: Clone workflow (system templates → user copy)
workflowsRouter.post('/workflows/:id/clone', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const source = await prisma.workflow.findUnique({ where: { id: req.params.id } });
  if (!source) { res.status(404).json({ error: 'not found' }); return; }
  const newId = `${source.id.slice(0, 30)}-${nanoid(8)}`;
  const cloned = await prisma.workflow.create({
    data: {
      id: newId,
      tenantId: r.tenant.id,
      name: `${source.name} 副本`,
      category: source.category,
      definition: source.definition,
      isSystem: false, // clone is always user-owned
    },
  });
  res.json({ workflow: { ...cloned, definition: safeParse(cloned.definition) } });
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
