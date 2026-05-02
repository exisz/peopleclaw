/**
 * App-to-App invoke endpoint (PLANET-1459).
 *
 * POST /api/apps/:targetAppId/invoke/:componentId
 *   - auth required + tenant scoped
 *   - target App must be in the same tenant as the caller
 *   - target Component must have isExported = true
 *   - body is forwarded as input to the component
 *
 * Returns { ok: true, result, probes } on success, { ok: false, error } on failure.
 */
import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { runComponentSync, type ComponentWithApp } from '../lib/componentInvoker.js';
import { buildCallAppCtx } from '../lib/callAppCtx.js';

export const appInvokeRouter = Router();

appInvokeRouter.post(
  '/apps/:targetAppId/invoke/:componentId',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const prisma = getPrisma();

    // Target app + component, scoped by tenant.
    const targetApp = await prisma.app.findFirst({
      where: { id: req.params.targetAppId, tenantId: r.tenant.id },
    });
    if (!targetApp) {
      res.status(403).json({ ok: false, error: 'target app not in your tenant' });
      return;
    }

    const component = await prisma.component.findFirst({
      where: { id: req.params.componentId, appId: targetApp.id },
      include: { app: true },
    });
    if (!component) {
      res.status(404).json({ ok: false, error: 'component not found' });
      return;
    }
    if (!component.isExported) {
      res.status(403).json({ ok: false, error: 'component is not exported (isExported=false)' });
      return;
    }

    try {
      const callApp = buildCallAppCtx(r.tenant.id);
      const { result, probes } = await runComponentSync(
        component as ComponentWithApp,
        req.body ?? {},
        { extraCtx: { callApp, input: req.body ?? {} } },
      );
      res.json({ ok: true, result, probes });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message ?? 'invoke failed' });
    }
  },
);
