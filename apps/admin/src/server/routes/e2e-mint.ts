import { Router } from 'express';
import type { Request, Response } from 'express';

/**
 * PLANET-1427: E2E mint endpoint — CI-friendly login without OAuth UI flow.
 *
 * POST /api/internal/e2e-mint-session
 * Header: X-E2E-Secret = process.env.E2E_SECRET
 * Body: { email?: string } (defaults to e2e@peopleclaw.test)
 *
 * Returns an opaque e2e token that our auth middleware recognizes
 * (format: `e2e:{secret}:{logtoId}`). The requireAuth middleware upserts the
 * user row automatically when it sees this token.
 *
 * Only registered when E2E_SECRET env var is set.
 */
export const e2eMintRouter = Router();

const E2E_SECRET = process.env.E2E_SECRET;

if (E2E_SECRET) {
  e2eMintRouter.post('/internal/e2e-mint-session', async (req: Request, res: Response) => {
    const secret = req.header('x-e2e-secret') || '';
    if (secret !== E2E_SECRET) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const email = (req.body?.email as string) || 'e2e@peopleclaw.test';

    // Use a deterministic logtoId for e2e so the user row is stable across runs
    const logtoId = `e2e-user-${email.replace(/[^a-z0-9]/gi, '-')}`;

    res.json({
      accessToken: `e2e:${E2E_SECRET}:${logtoId}`,
      expiresIn: 600,
      sub: logtoId,
      mode: 'e2e-bypass',
    });
  });
}
