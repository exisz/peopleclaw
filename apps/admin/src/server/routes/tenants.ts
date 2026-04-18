import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest, suggestSlug, uniqueSlug } from '../middleware/tenant.js';

export const tenantsRouter = Router();

// Create new tenant (any authed user can create one — they become owner)
tenantsRouter.post('/tenants', requireAuth, async (req, res) => {
  const r = req as AuthedRequest;
  const { name, slug } = req.body ?? {};
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  const prisma = getPrisma();
  const finalSlug = await uniqueSlug(prisma, slug || suggestSlug(r.user.email, r.user.id));
  const t = await prisma.tenant.create({
    data: { name, slug: finalSlug },
  });
  await prisma.tenantUser.create({ data: { tenantId: t.id, userId: r.user.id, role: 'owner' } });
  res.json({ tenant: { id: t.id, name: t.name, slug: t.slug, plan: t.plan, credits: t.credits, role: 'owner' } });
});

// All :slug routes are tenant-scoped + require membership
tenantsRouter.use('/tenants/:slug', requireAuth, requireTenant);

tenantsRouter.get('/tenants/:slug', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  res.json({
    tenant: {
      id: r.tenant.id, name: r.tenant.name, slug: r.tenant.slug,
      plan: r.tenant.plan, credits: r.tenant.credits, role: r.tenantUser.role,
    },
  });
});

// === Connections ===
tenantsRouter.get('/tenants/:slug/connections', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const conns = await prisma.connection.findMany({ where: { tenantId: r.tenant.id } });
  res.json({
    connections: conns.map((c) => ({
      id: c.id, type: c.type, enabled: c.enabled,
      // Mask credentials in response
      config: maskConfig(c.type, safeJSON(c.config)),
      createdAt: c.createdAt, updatedAt: c.updatedAt,
    })),
  });
});

tenantsRouter.post('/tenants/:slug/connections', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  if (r.tenantUser.role === 'member') { res.status(403).json({ error: 'admin/owner required' }); return; }
  const { type, config } = req.body ?? {};
  if (!type || typeof config !== 'object') { res.status(400).json({ error: 'type and config required' }); return; }
  const prisma = getPrisma();
  const c = await prisma.connection.upsert({
    where: { tenantId_type: { tenantId: r.tenant.id, type } },
    create: { tenantId: r.tenant.id, type, config: JSON.stringify(config) },
    update: { config: JSON.stringify(config), enabled: true },
  });
  res.json({
    connection: {
      id: c.id, type: c.type, enabled: c.enabled,
      config: maskConfig(c.type, safeJSON(c.config)),
    },
  });
});

tenantsRouter.delete('/tenants/:slug/connections/:id', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  if (r.tenantUser.role === 'member') { res.status(403).json({ error: 'admin/owner required' }); return; }
  const prisma = getPrisma();
  const conn = await prisma.connection.findUnique({ where: { id: req.params.id } });
  if (!conn || conn.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  await prisma.connection.delete({ where: { id: conn.id } });
  res.json({ ok: true });
});

// === Members ===
tenantsRouter.get('/tenants/:slug/members', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const members = await prisma.tenantUser.findMany({
    where: { tenantId: r.tenant.id },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({
    members: members.map((m) => ({
      id: m.id, userId: m.userId, role: m.role,
      email: m.user.email, createdAt: m.createdAt,
    })),
  });
});

tenantsRouter.post('/tenants/:slug/members', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  if (r.tenantUser.role === 'member') { res.status(403).json({ error: 'admin/owner required' }); return; }
  const { email, role } = req.body ?? {};
  if (!email) { res.status(400).json({ error: 'email required' }); return; }
  const prisma = getPrisma();
  // v1: lookup an existing User by email (no Logto invite email yet — TODO)
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    res.status(404).json({ error: 'user not found (must sign in first; invite-by-email TODO)' });
    return;
  }
  const m = await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: r.tenant.id, userId: user.id } },
    create: { tenantId: r.tenant.id, userId: user.id, role: role || 'member' },
    update: { role: role || undefined },
    include: { user: true },
  });
  res.json({ member: { id: m.id, userId: m.userId, email: m.user.email, role: m.role } });
});

tenantsRouter.delete('/tenants/:slug/members/:id', async (req, res) => {
  const r = req as unknown as TenantedRequest;
  if (r.tenantUser.role === 'member') { res.status(403).json({ error: 'admin/owner required' }); return; }
  const prisma = getPrisma();
  const m = await prisma.tenantUser.findUnique({ where: { id: parseInt(req.params.id, 10) } });
  if (!m || m.tenantId !== r.tenant.id) { res.status(404).json({ error: 'not found' }); return; }
  // Don't allow removing the last owner
  if (m.role === 'owner') {
    const owners = await prisma.tenantUser.count({ where: { tenantId: r.tenant.id, role: 'owner' } });
    if (owners <= 1) { res.status(400).json({ error: 'cannot remove last owner' }); return; }
  }
  await prisma.tenantUser.delete({ where: { id: m.id } });
  res.json({ ok: true });
});

function safeJSON(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}
function maskConfig(type: string, cfg: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...cfg };
  for (const k of ['admin_token', 'access_token', 'api_key', 'secret', 'password']) {
    if (typeof out[k] === 'string' && (out[k] as string).length > 0) {
      const v = out[k] as string;
      out[k] = v.length > 8 ? v.slice(0, 4) + '…' + v.slice(-4) : '••••';
    }
  }
  return out;
}
