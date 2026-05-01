import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';
import { compileFullstack } from '../../compiler/fullstack.js';

export const componentCompileRouter = Router();

// POST /api/components/:id/compile
componentCompileRouter.post('/components/:id/compile', async (req, res) => {
  try {
    const prisma = getPrisma();
    const component = await prisma.component.findUnique({ where: { id: req.params.id } });
    if (!component) return res.status(404).json({ error: 'Component not found' });
    if (component.type !== 'FULLSTACK' && component.type !== 'FRONTEND') return res.status(400).json({ error: 'Component is not FULLSTACK or FRONTEND type' });
    if (!component.code) return res.status(400).json({ error: 'Component has no code' });

    if (component.type === 'FULLSTACK') {
      const result = compileFullstack(component.code, component.id);
      await prisma.component.update({
        where: { id: component.id },
        data: { compiledArtifacts: JSON.stringify(result) },
      });
      res.json({ ok: true, compiledAt: result.compiledAt, probes: result.probes });
    } else {
      // FRONTEND: compile client-only bundle
      const { compileFrontend } = await import('../../compiler/frontend.js');
      const result = compileFrontend(component.code, component.id);
      await prisma.component.update({
        where: { id: component.id },
        data: { compiledArtifacts: JSON.stringify(result) },
      });
      res.json({ ok: true, compiledAt: result.compiledAt });
    }
  } catch (err: any) {
    console.error('[compile] error:', err);
    res.status(500).json({ error: err.message ?? 'Compile failed' });
  }
});
