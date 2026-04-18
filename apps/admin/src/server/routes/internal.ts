import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { exchangeShopifyClientCredentials } from '../lib/shopifyAuth.js';

/**
 * Internal endpoints — protected by Authorization: Bearer ${CRON_SECRET}.
 * Hit by Vercel Cron (apps/admin/vercel.json). Vercel Cron sends GET requests
 * with `Authorization: Bearer $CRON_SECRET` injected automatically; we also
 * accept POST so you can curl it manually.
 */
export const internalRouter = Router();

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const auth = req.header('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function handleRefresh(req: Request, res: Response) {
  if (!authorized(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const prisma = getPrisma();
  const conns = await prisma.connection.findMany({ where: { type: 'shopify', enabled: true } });
  const refreshed: string[] = [];
  const failed: Array<{ tenantId: string; connectionId: string; error: string }> = [];

  for (const c of conns) {
    let cfg: Record<string, unknown> = {};
    try { cfg = JSON.parse(c.config || '{}'); } catch {}
    const shop_domain = String(cfg.shop_domain || '');
    const client_id = String(cfg.client_id || '');
    const client_secret = String(cfg.client_secret || '');
    if (!shop_domain || !client_id || !client_secret) {
      failed.push({
        tenantId: c.tenantId, connectionId: c.id,
        error: 'missing shop_domain/client_id/client_secret',
      });
      continue;
    }
    try {
      const exch = await exchangeShopifyClientCredentials({ shop_domain, client_id, client_secret });
      const next = {
        ...cfg,
        shop_domain,
        client_id,
        client_secret,
        admin_token: exch.admin_token,
        token_expires_at: exch.token_expires_at,
      };
      await prisma.connection.update({
        where: { id: c.id },
        data: { config: JSON.stringify(next) },
      });
      refreshed.push(c.tenantId);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      failed.push({ tenantId: c.tenantId, connectionId: c.id, error: err });
    }
  }

  res.json({
    refreshed: refreshed.length,
    refreshedTenants: refreshed,
    failed,
    failedCount: failed.length,
    at: new Date().toISOString(),
  });
}

internalRouter.get('/internal/refresh-shopify-tokens', handleRefresh);
internalRouter.post('/internal/refresh-shopify-tokens', handleRefresh);
