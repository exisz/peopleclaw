import { Router, type Request, type Response } from 'express';
import { verifyBearer } from '../middleware/auth.js';
import { getPrisma } from '../lib/prisma.js';

export const meRouter = Router();

meRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const claims = await verifyBearer(req.header('authorization'));
    const prisma = getPrisma();
    const email = typeof claims.email === 'string' ? claims.email : null;

    const user = await prisma.user.upsert({
      where: { logtoId: claims.sub as string },
      create: { logtoId: claims.sub as string, email, visits: 1 },
      update: { visits: { increment: 1 }, email: email ?? undefined },
    });

    res.json({ user, claims });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(401).json({ error: msg });
  }
});
