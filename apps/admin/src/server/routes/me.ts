import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { getPrisma } from '../lib/prisma.js';

export const meRouter = Router();

meRouter.get('/me', requireAuth, async (req, res) => {
  const r = req as AuthedRequest;
  const { id, logtoId, email, credits, createdAt, visits } = r.user;
  const prisma = getPrisma();
  const memberships = await prisma.tenantUser.findMany({
    where: { userId: r.user.id },
    include: { tenant: true },
    orderBy: { createdAt: 'asc' },
  });
  const tenants = memberships.map((m) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    slug: m.tenant.slug,
    plan: m.tenant.plan,
    credits: m.tenant.credits,
    role: m.role,
  }));
  res.json({
    user: { id, logtoId, email, credits, createdAt, visits },
    tenants,
    claims: r.claims,
  });
});
