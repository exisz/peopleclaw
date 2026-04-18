import type { Request, Response, NextFunction } from 'express';
import { verifyBearer, type VerifiedClaims } from './auth.js';
import { getPrisma } from '../lib/prisma.js';
import type { User } from '../generated/prisma/index.js';
import { suggestSlug, uniqueSlug } from './tenant.js';

export interface AuthedRequest extends Request {
  user: User;
  claims: VerifiedClaims;
}

/**
 * Verifies Bearer token and attaches `req.user` (creating the User row if missing).
 * Responds 401 on failure.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const claims = await verifyBearer(req.header('authorization'));
    const prisma = getPrisma();
    const email = typeof claims.email === 'string' ? claims.email : null;
    const wasNew = !(await prisma.user.findUnique({ where: { logtoId: claims.sub } }));
    const user = await prisma.user.upsert({
      where: { logtoId: claims.sub },
      create: { logtoId: claims.sub, email, visits: 1 },
      update: { email: email ?? undefined },
    });
    if (wasNew) {
      // Auto-provision a personal tenant for this brand-new user
      const slug = await uniqueSlug(prisma, suggestSlug(email, user.id));
      const t = await prisma.tenant.create({
        data: { name: email ? `${email}'s Workspace` : `Workspace ${user.id}`, slug },
      });
      await prisma.tenantUser.create({ data: { tenantId: t.id, userId: user.id, role: 'owner' } });
    }
    (req as AuthedRequest).user = user;
    (req as AuthedRequest).claims = claims;
    next();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(401).json({ error: msg });
  }
}
