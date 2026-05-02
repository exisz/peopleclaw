import { Router } from 'express';
import { getPrisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../../middleware/tenant.js';
import { transformSync } from 'esbuild';
import { createSSEStream } from '@peopleclaw/sdk/sse';
import { resolveShopifyCreds } from '../../lib/shopifyClient.js';
import { decryptSecretsBag } from '../../lib/secretCrypto.js';

export const componentRunRouter = Router();

/**
 * POST /api/components/:id/run
 * Compiles user TS code → executes in restricted sandbox → streams SSE probes + result
 * (PLANET-1419)
 */
componentRunRouter.post(
  '/components/:id/run',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const prisma = getPrisma();

    // Fetch component scoped to tenant (include parent App for secrets)
    const component = await prisma.component.findFirst({
      where: {
        id: req.params.id,
        app: { tenantId: r.tenant.id },
      },
      include: { app: true },
    });

    if (!component) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }

    if (component.runtime !== 'PEOPLECLAW_CLOUD') {
      res.status(400).json({ error: `Unsupported runtime: ${component.runtime}` });
      return;
    }

    if (!component.code || component.code.trim() === '') {
      res.status(400).json({ error: 'Component has no code' });
      return;
    }

    // Compile TS/TSX → JS
    let compiledCode: string;
    try {
      const result = transformSync(component.code, {
        loader: 'tsx',
        target: 'esnext',
        format: 'esm',
        jsx: 'transform',
        jsxFactory: '__jsx',
        jsxFragment: '__Fragment',
      });
      compiledCode = result.code;
    } catch (err: any) {
      // SSE error for compile failure
      const sseResponse = createSSEStream(async () => {
        throw new Error(`compile failed: ${err?.message ?? 'Unknown error'}`);
      });
      const reader = (sseResponse.body as ReadableStream).getReader();
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      pump();
      return;
    }

    // Rewrite: strip all import statements (esbuild keeps them; we run in a Function sandbox)
    // SDK is injected as peopleClaw global; React/other imports are Client-only (server doesn't need them)
    compiledCode = compiledCode.replace(
      /import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?\n?/g,
      ''
    );
    compiledCode = compiledCode.replace(
      /import\s+.*\s+from\s*['"][^'"]+['"];?\n?/g,
      ''
    );

    const input = req.body ?? {};

    // Env whitelist — expose approved env vars via ctx.env (PLANET-1422, PLANET-1441)
    // Prefer Connection table (auto-refreshed) over stale env vars
    const envBag: Record<string, string> = {};
    const shopifyCreds = await resolveShopifyCreds(r.tenant.id);
    if (shopifyCreds) {
      envBag.SHOPIFY_DEV_SHOP = shopifyCreds.shop;
      envBag.SHOPIFY_DEV_ADMIN_TOKEN = shopifyCreds.token;
    } else {
      // Fallback to process.env for dev
      const ENV_WHITELIST = ['SHOPIFY_DEV_SHOP', 'SHOPIFY_DEV_ADMIN_TOKEN'];
      for (const key of ENV_WHITELIST) {
        if (process.env[key]) envBag[key] = process.env[key]!.replace(/\\n$/, '');
      }
    }

    // Per-App secrets (PLANET-1458) — decrypt and inject as ctx.secrets
    let secretsBag: Record<string, string> = {};
    try {
      secretsBag = decryptSecretsBag(component.app?.secrets);
    } catch (err) {
      // log but don't fail the run — empty secrets is safer than crash
      console.error('[run] failed to decrypt App secrets', err);
    }

    // Stream the execution via createSSEStream
    const sseResponse = createSSEStream(async (probe) => {
      // Build restricted execution environment
      const allowedGlobals = {
        peopleClaw: probe, // inject the SSE probe as peopleClaw
        fetch: globalThis.fetch,
        console,
        JSON,
        Math,
        Date,
        URL,
        URLSearchParams,
        Promise,
        setTimeout,
        clearTimeout,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Map,
        Set,
        WeakMap,
        WeakSet,
        Error,
        TypeError,
        RangeError,
        Symbol,
        RegExp,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        encodeURI,
        decodeURI,
        atob,
        btoa,
        // JSX stubs — FULLSTACK components contain Client JSX that compiles to __jsx calls.
        // Server-side run only executes server(), but the compiled code has __jsx references.
        __jsx: (...args: any[]) => ({ type: args[0], props: args[1], children: args.slice(2) }),
        __Fragment: Symbol('Fragment'),
      };

      // Wrap compiled code in an async function that returns the run export
      // esbuild ESM output uses: `export { name as default }` or `export { fn }` syntax
      let processedCode = compiledCode
        .replace(/export\s+default\s+/g, '__exports.default = ')
        .replace(/export\s+(?:async\s+)?function\s+run/g, '__exports.run = async function run')
        .replace(/export\s*\{([^}]+)\};?/g, (_, inner) => {
          // Parse "run as default" or "server" etc.
          return inner.split(',').map((part: string) => {
            const [name, alias] = part.trim().split(/\s+as\s+/);
            const key = (alias || name).trim();
            return `__exports["${key}"] = ${name.trim()};`;
          }).join('\n');
        });

      const wrappedCode = `
        ${Object.keys(allowedGlobals).map(k => `const ${k} = __globals.${k};`).join('\n')}
        const __exports = {};
        ${processedCode}
        return __exports;
      `;

      // Execute with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        const factory = new Function('__globals', '__signal', wrappedCode);
        const exports = factory(allowedGlobals, controller.signal);

        const runFn = exports.default ?? exports.run ?? exports.server;
        if (typeof runFn !== 'function') {
          throw new Error('Component has no default, "run", or "server" export');
        }

        // FULLSTACK server(ctx) takes single ctx arg; default/run take (input, ctx)
        const ctx = { signal: controller.signal, env: envBag, secrets: secretsBag, ...input };
        const args = (exports.server === runFn) ? [ctx] : [input, ctx];

        // Race against timeout
        const result = await Promise.race([
          runFn(...args),
          new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () =>
              reject(new Error('timeout'))
            );
          }),
        ]);

        return result;
      } finally {
        clearTimeout(timeout);
      }
    });

    // Pipe SSE response to express res
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = (sseResponse.body as ReadableStream).getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    pump();
  }
);
