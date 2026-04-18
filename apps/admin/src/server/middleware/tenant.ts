import type { Request, Response, NextFunction } from 'express';
import { getPrisma } from '../lib/prisma.js';
import type { AuthedRequest } from './requireAuth.js';
import type { Tenant, TenantUser } from '../generated/prisma/index.js';

export interface TenantedRequest extends AuthedRequest {
  tenant: Tenant;
  tenantUser: TenantUser;
}

/**
 * Resolve tenant for the request. Order:
 * 1. URL param :slug (when route is /api/tenants/:slug/...)
 * 2. x-tenant-slug header
 * 3. User's default (first) tenant
 * Verifies the user is a member; 403 otherwise.
 */
export async function requireTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  const r = req as AuthedRequest;
  if (!r.user) { res.status(401).json({ error: 'requireAuth must run first' }); return; }

  const prisma = getPrisma();
  const slugParam = (req.params?.slug as string | undefined) || (req.header('x-tenant-slug') ?? undefined);

  let tenantUser: (TenantUser & { tenant: Tenant }) | null = null;

  if (slugParam) {
    const t = await prisma.tenant.findUnique({ where: { slug: slugParam } });
    if (!t) { res.status(404).json({ error: `tenant '${slugParam}' not found` }); return; }
    tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: t.id, userId: r.user.id } },
      include: { tenant: true },
    });
    if (!tenantUser) { res.status(403).json({ error: 'not a member of tenant' }); return; }
  } else {
    // User's first tenant — ensures we always have one (auto-provisioned at sign-in)
    tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: r.user.id },
      orderBy: { createdAt: 'asc' },
      include: { tenant: true },
    });
    if (!tenantUser) {
      // Auto-provision a personal tenant on the fly (defensive)
      const slug = await uniqueSlug(prisma, suggestSlug(r.user.email, r.user.id));
      const newT = await prisma.tenant.create({
        data: {
          name: r.user.email ? `${r.user.email}'s Workspace` : `Workspace ${r.user.id}`,
          slug,
        },
      });
      tenantUser = await prisma.tenantUser.create({
        data: { tenantId: newT.id, userId: r.user.id, role: 'owner' },
        include: { tenant: true },
      });
    }
  }

  const tr = req as unknown as TenantedRequest;
  tr.tenant = tenantUser.tenant;
  tr.tenantUser = tenantUser;
  next();
}

export function suggestSlug(email: string | null | undefined, userId: number): string {
  const base = email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : `user-${userId}`;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base.slice(0, 24)}-${rand}`;
}

export async function uniqueSlug(prisma: ReturnType<typeof getPrisma>, candidate: string): Promise<string> {
  let slug = candidate;
  let i = 0;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${candidate}-${i}`;
    if (i > 50) throw new Error('cannot allocate unique slug');
  }
  return slug;
}
