import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';
import { decryptSecretsBag } from '../../lib/secretCrypto.js';
import { buildCallAppCtx } from '../../lib/callAppCtx.js';
import { buildAppStoreCtx } from '../../lib/appStoreCtx.js';

export const componentServerRouter = Router();

// GET /api/components/:id/server — execute server handler and return JSON
componentServerRouter.get('/components/:id/server', async (req, res) => {
  try {
    const prisma = getPrisma();
    const component = await prisma.component.findUnique({
      where: { id: req.params.id },
      include: { app: true },
    });
    if (!component) return res.status(404).json({ error: 'Component not found' });

    const artifacts = typeof component.compiledArtifacts === 'string'
      ? JSON.parse(component.compiledArtifacts)
      : component.compiledArtifacts as any;
    if (!artifacts?.serverHandler) {
      return res.status(400).json({ error: 'Component not compiled. POST /compile first.' });
    }

    // PLANET-1463: core no longer injects Shopify-specific env. ctx.env stays
    // available as a generic empty bag for back-compat with old serverHandlers.
    const envBag: Record<string, string> = {};

    // PLANET-1458: decrypt App.secrets so server handlers can read ctx.secrets.X
    let secretsBag: Record<string, string> = {};
    try {
      secretsBag = decryptSecretsBag(component.app?.secrets);
    } catch (err) {
      console.error('[component/server] failed to decrypt secrets', err);
    }

    // PLANET-1459/1461: inject callApp so FULLSTACK server() can fan out to
    // sibling components (e.g. shopify connector) inside the same App.
    const callApp = component.app
      ? buildCallAppCtx(component.app.tenantId)
      : undefined;
    const appStore = component.app
      ? await buildAppStoreCtx({
          tenantId: component.app.tenantId,
          appId: component.app.id,
        })
      : undefined;

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

    const result = await serverFn({
      env: envBag,
      secrets: secretsBag,
      callApp,
      appStore,
      app: component.app ? { id: component.app.id, tenantId: component.app.tenantId } : undefined,
      appId: component.app?.id,
    });
    // PLANET-1577: persist queued ctx.appStore writes before responding so
    // the next request sees them.
    if (appStore) {
      try { await appStore.flush(); }
      catch (err) { console.error('[component/server] appStore.flush failed', err); }
    }
    res.json(result);
  } catch (err: any) {
    console.error('[component/server] error:', err);
    res.status(500).json({ error: err.message ?? 'Server execution failed' });
  }
});
