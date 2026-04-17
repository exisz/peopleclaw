import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

export const meRouter = Router();

meRouter.get('/me', requireAuth, async (req, res) => {
  const r = req as AuthedRequest;
  const { id, logtoId, email, credits, createdAt, visits } = r.user;
  res.json({ user: { id, logtoId, email, credits, createdAt, visits }, claims: r.claims });
});
