import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPrisma } from '../lib/prisma.js';

/**
 * Test-only routes (PLANET-925 P3.16).
 *
 * Mounted ONLY when E2E_TEST_TOKEN is set. In production this env var is
 * unset, so the entire router is a no-op (404).
 *
 * Pair with `requireAuth` sudo bypass: clients call POST /api/test/sudo-login
 * with the token, get back { userId, tenantSlug, sudoToken }, then send
 * subsequent requests with:
 *     Authorization: Sudo <sudoToken>
 *     X-Sudo-User-Id: <userId>
 * to bypass Logto entirely.
 */
export const testRouter = Router();

const ENABLED = !!process.env.E2E_TEST_TOKEN;

testRouter.post('/test/sudo-login', async (req: Request, res: Response) => {
  if (!ENABLED) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const tokenHeader = (req.header('authorization') || '').replace(/^bearer\s+/i, '').trim();
  const tokenBody = typeof req.body?.token === 'string' ? req.body.token : '';
  const provided = tokenHeader || tokenBody;
  if (provided !== process.env.E2E_TEST_TOKEN) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  const userId = Number(req.body?.userId);
  const tenantSlug = String(req.body?.tenantSlug || '');
  if (!Number.isFinite(userId) || !tenantSlug) {
    res.status(400).json({ error: 'userId (number) and tenantSlug (string) required' });
    return;
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'user_not_found' });
    return;
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    res.status(404).json({ error: 'tenant_not_found' });
    return;
  }
  const membership = await prisma.tenantUser.findFirst({
    where: { tenantId: tenant.id, userId: user.id },
  });
  if (!membership) {
    res.status(403).json({ error: 'user_not_in_tenant' });
    return;
  }

  res.json({
    userId: user.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    sudoToken: process.env.E2E_TEST_TOKEN,
    usage: {
      header: 'Authorization: Sudo <sudoToken>',
      headerExtra: 'X-Sudo-User-Id: <userId>',
    },
  });
});
