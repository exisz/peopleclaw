import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../../middleware/tenant.js';
import { createSSEStream } from '@peopleclaw/sdk/sse';
import { runComponentWithProbe, type ComponentWithApp } from '../../lib/componentInvoker.js';
import { buildCallAppCtx } from '../../lib/callAppCtx.js';
import { buildAppStoreCtx } from '../../lib/appStoreCtx.js';

export const componentRunRouter = Router();

/**
 * POST /api/components/:id/run
 * Compiles user TS code → executes in restricted sandbox → streams SSE probes + result.
 * (PLANET-1419, refactored under PLANET-1459 to use shared componentInvoker.)
 */
componentRunRouter.post(
  '/components/:id/run',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const prisma = getPrisma();

    const component = await prisma.component.findFirst({
      where: {
        id: req.params.id,
        app: { tenantId: r.tenant.id },
      },
      include: { app: true },
    });

    if (!component) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    if (component.runtime !== 'PEOPLECLAW_CLOUD') {
      res.status(400).json({ error: `Unsupported runtime: ${component.runtime}` });
      return;
    }
    if (!component.code || component.code.trim() === '') {
      res.status(400).json({ error: 'Component has no code' });
      return;
    }

    const input = req.body ?? {};
    const callApp = buildCallAppCtx(r.tenant.id);
    // PLANET-1577: durable per-app store, scoped to caller tenant.
    const appStore = component.app
      ? await buildAppStoreCtx({ tenantId: r.tenant.id, appId: component.app.id })
      : undefined;

    const sseResponse = createSSEStream(async (probe) => {
      try {
        return await runComponentWithProbe(
          component as ComponentWithApp,
          input,
          probe,
          { extraCtx: { callApp, appStore, input } },
        );
      } finally {
        // Make sure pending appStore writes hit the DB before we close the SSE
        // stream / send the final response (PLANET-1577).
        if (appStore) {
          try { await appStore.flush(); }
          catch (err) { console.error('[components/run] appStore.flush failed', err); }
        }
      }
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = (sseResponse.body as ReadableStream).getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    pump();
  },
);
