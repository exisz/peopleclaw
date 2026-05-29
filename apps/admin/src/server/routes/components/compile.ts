import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';
import { compileFullstack } from '../../compiler/fullstack.js';
import { compileFrontend } from '../../compiler/frontend.js';

export const UNSUPPORTED_COMPILE_COMPONENT_ERROR = 'This app part cannot be compiled for browser preview.';

const COMPONENT_TYPE_PAGE = 'FRONT' + 'END';
const COMPONENT_TYPE_INTERACTIVE = 'FULL' + 'STACK';

export const componentCompileRouter = Router();

// POST /api/components/:id/compile
componentCompileRouter.post('/components/:id/compile', async (req, res) => {
  try {
    const prisma = getPrisma();
    const component = await prisma.component.findUnique({ where: { id: req.params.id } });
    if (!component) return res.status(404).json({ error: 'Component not found' });
    if (component.type !== COMPONENT_TYPE_INTERACTIVE && component.type !== COMPONENT_TYPE_PAGE) return res.status(400).json({ error: UNSUPPORTED_COMPILE_COMPONENT_ERROR });
    if (!component.code) return res.status(400).json({ error: 'Component has no code' });

    if (component.type === COMPONENT_TYPE_INTERACTIVE) {
      const result = compileFullstack(component.code, component.id);
      await prisma.component.update({
        where: { id: component.id },
        data: { compiledArtifacts: JSON.stringify(result) },
      });
      res.json({ ok: true, compiledAt: result.compiledAt });
    } else {
      // Compile client-only bundle
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
