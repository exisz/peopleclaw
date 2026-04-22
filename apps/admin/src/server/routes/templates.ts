/**
 * PLANET-1103: Template library routes.
 *
 * GET  /api/templates         — list all global templates
 * POST /api/templates/:id/use — clone a template into the current tenant's workspace
 */
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { TEMPLATES } from '../lib/starterWorkflow.js';

export const templatesRouter = Router();

// GET /api/templates — public list (no auth required; templates are global)
templatesRouter.get('/templates', (_req, res) => {
  const list = TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category ?? null,
    description: (t as { description?: string }).description ?? null,
    stepCount: t.definition.steps.length,
    steps: t.definition.steps.map((s) => ({ name: s.name })),
  }));
  res.json({ templates: list });
});

// POST /api/templates/:id/use — clone template into current tenant
templatesRouter.post('/templates/:id/use', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const template = TEMPLATES.find((t) => t.id === req.params.id);
  if (!template) {
    res.status(404).json({ error: 'template not found' });
    return;
  }

  const prisma = getPrisma();
  const tenantId = r.tenant.id;

  // Resolve name — handle duplicate: "商品工作流1 (2)", "(3)", …
  let name = template.name;
  const existing = await prisma.workflow.findMany({
    where: { tenantId, name: { startsWith: template.name } },
    select: { name: true },
  });
  if (existing.length > 0) {
    const usedNames = new Set(existing.map((w) => w.name));
    let suffix = 2;
    while (usedNames.has(`${template.name} (${suffix})`)) suffix++;
    name = `${template.name} (${suffix})`;
  }

  const id = `${template.id}-${nanoid(8)}`;
  const workflow = await prisma.workflow.create({
    data: {
      id,
      tenantId,
      name,
      category: template.category ?? null,
      definition: JSON.stringify(template.definition),
    },
  });

  res.json({ workflow: { id: workflow.id, name: workflow.name } });
});
