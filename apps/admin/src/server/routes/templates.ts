import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { type AppTemplate } from '../seed/templates/ecommerce-starter.js';
import {
  starterAppTemplate,
  STARTER_APP_CONNECTOR_NAME,
  STARTER_APP_FULLSTACK_NAME,
} from '../seed/templates/starter-app.js';
import { distillProbes } from '../compiler/distill-probes.js';
import { encryptSecretsBag } from '../lib/secretCrypto.js';

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

  // PLANET-1461: optionally auto-seed dev Shopify creds for the starter app so
  // the demo works out-of-the-box. Skip silently if env not set (e.g. local).
  const devShop = process.env.SHOPIFY_DEV_SHOP?.replace(/\\n$/, '').trim();
  const devToken = process.env.SHOPIFY_DEV_ADMIN_TOKEN?.replace(/\\n$/, '').trim();

  // Create app + components + connections in a transaction
  const app = await prisma.$transaction(async (tx) => {
    const seededSecrets =
      template.id === 'starter-app' && devShop && devToken
        ? encryptSecretsBag({
            SHOPIFY_SHOP_DOMAIN: devShop,
            SHOPIFY_ADMIN_TOKEN: devToken,
          })
        : null;

    const newApp = await tx.app.create({
      data: {
        tenantId: r.tenant.id,
        name: template.name,
        description: template.description,
        updatedAt: new Date(),
        secrets: seededSecrets,
      },
    });

    // First pass: create non-FULLSTACK components so we know the connector id
    // before we patch the FULLSTACK code.
    const componentIds: (string | null)[] = template.components.map(() => null);
    let connectorId: string | null = null;

    for (let i = 0; i < template.components.length; i++) {
      const comp = template.components[i]!;
      if (comp.type === 'FULLSTACK') continue; // defer
      const probes = comp.type === 'BACKEND'
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
          isExported: Boolean(comp.isExported),
        },
      });
      componentIds[i] = created.id;
      if (comp.name === STARTER_APP_CONNECTOR_NAME) connectorId = created.id;
    }

    // Second pass: FULLSTACK components, patching __APP_ID__/__CONNECTOR_ID__.
    for (let i = 0; i < template.components.length; i++) {
      const comp = template.components[i]!;
      if (comp.type !== 'FULLSTACK') continue;
      let code = comp.code;
      if (
        template.id === 'starter-app'
        && comp.name === STARTER_APP_FULLSTACK_NAME
      ) {
        code = code
          .replace(/__APP_ID__/g, newApp.id)
          .replace(/__CONNECTOR_ID__/g, connectorId ?? '');
      }
      const probes = JSON.stringify(distillProbes(code));
      const created = await tx.component.create({
        data: {
          appId: newApp.id,
          name: comp.name,
          type: comp.type,
          runtime: 'PEOPLECLAW_CLOUD',
          icon: comp.icon,
          code,
          canvasX: comp.canvasX,
          canvasY: comp.canvasY,
          probes,
          isExported: Boolean(comp.isExported),
        },
      });
      componentIds[i] = created.id;
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
