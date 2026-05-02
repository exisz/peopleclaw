import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../../middleware/tenant.js';

export const componentDetailRouter = Router();

// PATCH /api/components/:id/export — toggle Component.isExported (PLANET-1459)
componentDetailRouter.patch(
  '/components/:id/export',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const prisma = getPrisma();
    const isExported = Boolean(req.body?.isExported);
    // Tenant scope: component must belong to an App in this tenant.
    const component = await prisma.component.findFirst({
      where: { id: req.params.id, app: { tenantId: r.tenant.id } },
    });
    if (!component) {
      res.status(404).json({ error: 'component not found' });
      return;
    }
    const updated = await prisma.component.update({
      where: { id: component.id },
      data: { isExported },
    });
    res.json({ component: { id: updated.id, isExported: (updated as any).isExported } });
  },
);

// GET /api/components/:id — get component detail (PLANET-1424)
componentDetailRouter.get('/components/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const component = await prisma.component.findUnique({ where: { id: req.params.id } });
    if (!component) return res.status(404).json({ error: 'Component not found' });
    res.json({ component });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch component' });
  }
});

// GET /api/components/:id/connections — get component connections (PLANET-1440)
componentDetailRouter.get('/components/:id/connections', async (req, res) => {
  try {
    const prisma = getPrisma();
    const connections = await prisma.componentConnection.findMany({
      where: {
        OR: [
          { fromComponentId: req.params.id },
          { toComponentId: req.params.id },
        ],
      },
    });
    res.json({ connections });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch connections' });
  }
});
