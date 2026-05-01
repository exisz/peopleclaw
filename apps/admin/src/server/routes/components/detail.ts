import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';

export const componentDetailRouter = Router();

// GET /api/components/:id — get component detail (PLANET-1424)
componentDetailRouter.get('/components/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    const component = await prisma.component.findUnique({ where: { id: req.params.id } });
    if (!component) return res.status(404).json({ error: 'Component not found' });
    res.json({ component });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch component' });
  }
});
