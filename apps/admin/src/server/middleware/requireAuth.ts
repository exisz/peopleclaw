import type { Request, Response, NextFunction } from 'express';
import { verifyBearer, type VerifiedClaims } from './auth.js';
import { getPrisma } from '../lib/prisma.js';
import type { User } from '../generated/prisma/index.js';

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
    const user = await prisma.user.upsert({
      where: { logtoId: claims.sub },
      create: { logtoId: claims.sub, email, visits: 1 },
      update: { email: email ?? undefined },
    });
    (req as AuthedRequest).user = user;
    (req as AuthedRequest).claims = claims;
    next();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(401).json({ error: msg });
  }
}
