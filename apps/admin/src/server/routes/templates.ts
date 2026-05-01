import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { type AppTemplate } from '../seed/templates/ecommerce-starter.js';
import { starterAppTemplate } from '../seed/templates/starter-app.js';
import { distillProbes } from '../compiler/distill-probes.js';

export const templatesRouter = Router();

const TEMPLATES: Record<string, AppTemplate> = {
  'starter-app': starterAppTemplate,
};

// GET /api/apps/templates — list available templates (no auth needed, static data)
templatesRouter.get('/apps/templates', (_req, res) => {
  const list = Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    componentCount: t.components.length,
  }));
  res.json({ templates: list });
});

// POST /api/apps/from-template — create app from template
templatesRouter.post('/apps/from-template', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { templateId } = req.body ?? {};

  if (!templateId || typeof templateId !== 'string') {
    res.status(400).json({ error: 'templateId is required' });
    return;
  }

  const template = TEMPLATES[templateId];
  if (!template) {
    res.status(404).json({ error: `Template "${templateId}" not found` });
    return;
  }

  const prisma = getPrisma();

  // Create app + components + connections in a transaction
  const app = await prisma.$transaction(async (tx) => {
    const newApp = await tx.app.create({
      data: {
        tenantId: r.tenant.id,
        name: template.name,
        description: template.description,
        updatedAt: new Date(),
      },
    });

    // Create components
    const componentIds: string[] = [];
    for (const comp of template.components) {
      // Auto-distill probes for BACKEND/FULLSTACK components
      const probes = (comp.type === 'BACKEND' || comp.type === 'FULLSTACK')
        ? JSON.stringify(distillProbes(comp.code))
        : null;
      const created = await tx.component.create({
        data: {
          appId: newApp.id,
          name: comp.name,
          type: comp.type,
          runtime: 'PEOPLECLAW_CLOUD',
          icon: comp.icon,
          code: comp.code,
          canvasX: comp.canvasX,
          canvasY: comp.canvasY,
          probes,
        },
      });
      componentIds.push(created.id);
    }

    // Create connections
    for (const conn of template.connections) {
      await tx.componentConnection.create({
        data: {
          appId: newApp.id,
          fromComponentId: componentIds[conn.fromIndex]!,
          toComponentId: componentIds[conn.toIndex]!,
          type: conn.type,
        },
      });
    }

    return newApp;
  });

  res.json({ app: { id: app.id, name: app.name } });
});
