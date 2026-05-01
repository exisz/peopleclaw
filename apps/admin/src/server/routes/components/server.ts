import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';

export const componentServerRouter = Router();

// GET /api/components/:id/server — execute server handler and return JSON
componentServerRouter.get('/components/:id/server', async (req, res) => {
  try {
    const prisma = getPrisma();
    const component = await prisma.component.findUnique({ where: { id: req.params.id } });
    if (!component) return res.status(404).json({ error: 'Component not found' });

    const artifacts = typeof component.compiledArtifacts === 'string' 
      ? JSON.parse(component.compiledArtifacts) 
      : component.compiledArtifacts as any;
    if (!artifacts?.serverHandler) {
      return res.status(400).json({ error: 'Component not compiled. POST /compile first.' });
    }

    // Execute the server handler in a minimal sandbox via dynamic import
    const dataUrl = `data:text/javascript;base64,${Buffer.from(artifacts.serverHandler).toString('base64')}`;
    const mod = await import(/* @vite-ignore */ dataUrl);
    const serverFn = mod.default ?? mod.server;
    if (typeof serverFn !== 'function') {
      return res.status(500).json({ error: 'Compiled server handler is not a function' });
    }

    // Provide empty ctx for now (future: inject integrations)
    const result = await serverFn({});
    res.json(result);
  } catch (err: any) {
    console.error('[component/server] error:', err);
    res.status(500).json({ error: err.message ?? 'Server execution failed' });
  }
});
