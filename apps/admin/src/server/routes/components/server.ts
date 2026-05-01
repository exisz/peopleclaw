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

    // Env whitelist for fullstack server handlers (PLANET-1422)
    const ENV_WHITELIST = ['SHOPIFY_DEV_SHOP', 'SHOPIFY_DEV_ADMIN_TOKEN'];
    const envBag: Record<string, string> = {};
    for (const key of ENV_WHITELIST) {
      if (process.env[key]) envBag[key] = process.env[key]!;
    }
    console.log('[component/server] env keys available:', Object.keys(envBag));

    // Execute server handler via Function sandbox (data: URL import unreliable on Vercel)
    // Strip import/export statements and run as a function body
    let code = artifacts.serverHandler;
    code = code.replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
    code = code.replace(/import\s+.*\s+from\s*['"][^'"]+['"];?\n?/g, '');
    code = code.replace(/export\s+default\s+/g, '__exports.default = ');
    code = code.replace(/export\s+(?:async\s+)?function\s+server/g, '__exports.server = async function server');
    code = code.replace(/export\s*\{([^}]+)\};?/g, (_: string, inner: string) => {
      return inner.split(',').map((part: string) => {
        const [name, alias] = part.trim().split(/\s+as\s+/);
        const key = (alias || name).trim();
        return `__exports["${key}"] = ${name.trim()};`;
      }).join('\n');
    });

    const wrappedCode = `
      const __exports = {};
      ${code}
      return __exports;
    `;

    const factory = new Function('fetch', 'console', 'JSON', 'Date', 'URL', 'URLSearchParams', 'Promise', 'setTimeout', 'Math', wrappedCode);
    const exports = factory(globalThis.fetch, console, JSON, Date, URL, URLSearchParams, Promise, setTimeout, Math);

    const serverFn = exports.default ?? exports.server;
    if (typeof serverFn !== 'function') {
      return res.status(500).json({ error: 'Compiled server handler is not a function' });
    }

    // Provide ctx with env for server handler
    const result = await serverFn({ env: envBag });
    res.json(result);
  } catch (err: any) {
    console.error('[component/server] error:', err);
    res.status(500).json({ error: err.message ?? 'Server execution failed' });
  }
});
