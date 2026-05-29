import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { createScopedAppNotFoundBody } from '../lib/scopedNotFound.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';

export const INVALID_COMPONENT_TYPE_ERROR = 'Choose a page, module, or component for this app part.';

export const appsRouter = Router();

// GET /api/apps — list apps for current tenant
appsRouter.get('/apps', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const apps = await prisma.app.findMany({
    where: { tenantId: r.tenant.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ apps });
});

// POST /api/apps — create app
appsRouter.post('/apps', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { name, description } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const prisma = getPrisma();
  const app = await prisma.app.create({
    data: {
      tenantId: r.tenant.id,
      name,
      description: description ?? null,
      updatedAt: new Date(),
    },
  });
  res.json({ app });
});

// POST /api/apps/:appId/components — create component (PLANET-1459)
// Tenant-scoped helper used by e2e + future UI flows.
appsRouter.post('/apps/:appId/components', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const { name, type, code, runtime, isExported } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (!['FRONTEND', 'BACKEND', 'FULLSTACK'].includes(type)) {
    res.status(400).json({ error: INVALID_COMPONENT_TYPE_ERROR });
    return;
  }
  const app = await prisma.app.findFirst({
    where: { id: req.params.appId, tenantId: r.tenant.id },
  });
  if (!app) {
    res.status(404).json(createScopedAppNotFoundBody());
    return;
  }
  const component = await prisma.component.create({
    data: {
      appId: app.id,
      name,
      type: type as any,
      runtime: (runtime as any) ?? 'PEOPLECLAW_CLOUD',
      code: typeof code === 'string' ? code : '',
      isExported: Boolean(isExported),
    },
  });
  res.json({ component });
});

// GET /api/apps/:id — get app with code components
appsRouter.get('/apps/:id', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const app = await prisma.app.findFirst({
    where: { id: req.params.id, tenantId: r.tenant.id },
    include: {
      components: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!app) {
    res.status(404).json(createScopedAppNotFoundBody());
    return;
  }
  res.json({ app });
});
