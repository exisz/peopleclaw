/**
 * Shared component invocation logic (PLANET-1459).
 *
 * Extracts the sandbox/eval pipeline from routes/components/run.ts so it can be
 * reused by:
 *   - the SSE /run endpoint (run.ts)
 *   - the App-to-App invoke endpoint (appInvoke.ts)
 *   - ctx.callApp helper injected into running components
 *
 * Call modes:
 *   - withProbe(component, input, probe) → awaitable result; emits SSE probe events
 *     via the supplied probe (when running inside createSSEStream)
 *   - invokeSync(component, input) → awaitable result; collects probes into an array
 *     (no streaming) — used by /api/apps/:targetAppId/invoke/:componentId and
 *     ctx.callApp.
 */
import { transformSync } from 'esbuild';
import type { SSEProbe } from '@peopleclaw/sdk/sse';
import { resolveShopifyCreds } from './shopifyClient.js';
import { decryptSecretsBag } from './secretCrypto.js';
import type { Component, App } from '../generated/prisma/index.js';

export type ComponentWithApp = Component & { app: App | null };

export interface InvokeContextExtensions {
  /** Inject extra ctx fields (e.g. callApp helper). */
  extraCtx?: Record<string, unknown>;
}

interface CompiledRun {
  factory: (globals: Record<string, unknown>, signal: AbortSignal) => Record<string, unknown>;
}

function compileComponent(component: ComponentWithApp): CompiledRun {
  if (component.runtime !== 'PEOPLECLAW_CLOUD') {
    throw new Error(`Unsupported runtime: ${component.runtime}`);
  }
  if (!component.code || component.code.trim() === '') {
    throw new Error('Component has no code');
  }

  const transformed = transformSync(component.code, {
    loader: 'tsx',
    target: 'esnext',
    format: 'esm',
    jsx: 'transform',
    jsxFactory: '__jsx',
    jsxFragment: '__Fragment',
  });

  let compiledCode = transformed.code;
  // Strip imports — we run in a Function sandbox; SDK is injected as peopleClaw global.
  compiledCode = compiledCode.replace(
    /import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?\n?/g,
    ''
  );
  compiledCode = compiledCode.replace(
    /import\s+.*\s+from\s*['"][^'"]+['"];?\n?/g,
    ''
  );
  // Map ESM exports to __exports object.
  let processedCode = compiledCode
    .replace(/export\s+default\s+/g, '__exports.default = ')
    .replace(/export\s+(?:async\s+)?function\s+run/g, '__exports.run = async function run')
    .replace(/export\s*\{([^}]+)\};?/g, (_, inner) => {
      return inner.split(',').map((part: string) => {
        const [name, alias] = part.trim().split(/\s+as\s+/);
        const key = (alias || name).trim();
        return `__exports["${key}"] = ${name.trim()};`;
      }).join('\n');
    });

  const allowedGlobalNames = [
    'peopleClaw', 'fetch', 'console', 'JSON', 'Math', 'Date', 'URL', 'URLSearchParams',
    'Promise', 'setTimeout', 'clearTimeout', 'Array', 'Object', 'String', 'Number',
    'Boolean', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Error', 'TypeError', 'RangeError',
    'Symbol', 'RegExp', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'atob', 'btoa',
    '__jsx', '__Fragment',
  ];

  const wrappedCode = `
    ${allowedGlobalNames.map(k => `const ${k} = __globals.${k};`).join('\n')}
    const __exports = {};
    ${processedCode}
    return __exports;
  `;

  const factory = new Function('__globals', '__signal', wrappedCode) as CompiledRun['factory'];
  return { factory };
}

async function buildEnvBag(tenantId: string): Promise<Record<string, string>> {
  const envBag: Record<string, string> = {};
  const shopifyCreds = await resolveShopifyCreds(tenantId);
  if (shopifyCreds) {
    envBag.SHOPIFY_DEV_SHOP = shopifyCreds.shop;
    envBag.SHOPIFY_DEV_ADMIN_TOKEN = shopifyCreds.token;
  } else {
    const ENV_WHITELIST = ['SHOPIFY_DEV_SHOP', 'SHOPIFY_DEV_ADMIN_TOKEN'];
    for (const key of ENV_WHITELIST) {
      if (process.env[key]) envBag[key] = process.env[key]!.replace(/\\n$/, '');
    }
  }
  return envBag;
}

function buildSecretsBag(component: ComponentWithApp): Record<string, string> {
  try {
    return decryptSecretsBag(component.app?.secrets);
  } catch (err) {
    console.error('[componentInvoker] failed to decrypt App secrets', err);
    return {};
  }
}

function makeAllowedGlobals(probe: SSEProbe): Record<string, unknown> {
  return {
    peopleClaw: probe,
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
    __jsx: (...args: any[]) => ({ type: args[0], props: args[1], children: args.slice(2) }),
    __Fragment: Symbol('Fragment'),
  };
}

/**
 * Run a component, streaming probes through the supplied SSE probe.
 * Throws on failure; caller is expected to be inside createSSEStream.
 */
export async function runComponentWithProbe(
  component: ComponentWithApp,
  input: any,
  probe: SSEProbe,
  ext: InvokeContextExtensions = {},
): Promise<unknown> {
  const { factory } = compileComponent(component);
  const envBag = await buildEnvBag(component.app!.tenantId);
  const secretsBag = buildSecretsBag(component);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const exports = factory(makeAllowedGlobals(probe), controller.signal);
    const runFn = (exports as any).default ?? (exports as any).run ?? (exports as any).server;
    if (typeof runFn !== 'function') {
      throw new Error('Component has no default, "run", or "server" export');
    }
    const ctx = {
      signal: controller.signal,
      env: envBag,
      secrets: secretsBag,
      ...(ext.extraCtx ?? {}),
      ...input,
    };
    const args = ((exports as any).server === runFn) ? [ctx] : [input, ctx];
    const result = await Promise.race([
      (runFn as Function)(...args),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('timeout')));
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export interface SyncProbeRecord {
  node: string;
  ts: number;
}

/**
 * Synchronous (non-streaming) invocation. Returns { result, probes }.
 * Used by /api/apps/:targetAppId/invoke/:componentId and ctx.callApp.
 */
export async function runComponentSync(
  component: ComponentWithApp,
  input: any,
  ext: InvokeContextExtensions = {},
): Promise<{ result: unknown; probes: SyncProbeRecord[] }> {
  const probes: SyncProbeRecord[] = [];
  const probe: SSEProbe = {
    async nodeEntry(node: string) {
      probes.push({ node, ts: Date.now() });
    },
  };
  const result = await runComponentWithProbe(component, input, probe, ext);
  return { result, probes };
}
