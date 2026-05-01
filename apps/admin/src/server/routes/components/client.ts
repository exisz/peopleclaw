import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';

export const componentClientRouter = Router();

// GET /api/components/:id/client.js — serve compiled client bundle (FULLSTACK or FRONTEND)
componentClientRouter.get('/components/:id/client.js', async (req, res) => {
  try {
    const prisma = getPrisma();
    const component = await prisma.component.findUnique({ where: { id: req.params.id } });
    if (!component) return res.status(404).send('// Component not found');

    const artifacts = typeof component.compiledArtifacts === 'string'
      ? JSON.parse(component.compiledArtifacts)
      : component.compiledArtifacts as any;
    if (!artifacts?.clientBundle) {
      return res.status(400).send('// Component not compiled. POST /compile first.');
    }

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send(artifacts.clientBundle);
  } catch (err: any) {
    console.error('[component/client.js] error:', err);
    res.status(500).send(`// Error: ${err.message}`);
  }
});
