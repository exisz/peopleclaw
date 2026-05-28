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
 *   - withProgress(component, input, progress) → awaitable result; emits SSE progress events
 *     via the supplied progress (when running inside createSSEStream)
 *   - invokeSync(component, input) → awaitable result; used by /api/apps/:targetAppId/invoke/:componentId and
 *     ctx.callApp.
 */
import { transformSync } from 'esbuild';
import type { SSEProgress } from '@peopleclaw/sdk/sse';
import { decryptSecretsBag } from './secretCrypto.js';
import { buildUpdateAppSecretsCtx } from './appSecretsCtx.js';
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

async function buildEnvBag(_tenantId: string): Promise<Record<string, string>> {
  // ctx.env is a generic injection point for future platform use; today it's empty.
  return {};
}

function buildSecretsBag(component: ComponentWithApp): Record<string, string> {
  try {
    return decryptSecretsBag(component.app?.secrets);
  } catch (err) {
    console.error('[componentInvoker] failed to decrypt App secrets', err);
    return {};
  }
}

function makeAllowedGlobals(progress: SSEProgress): Record<string, unknown> {
  return {
    peopleClaw: progress,
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
 * Run a component with optional progress events.
 * Throws on failure; caller is expected to be inside createSSEStream.
 */
export async function runComponentWithProgress(
  component: ComponentWithApp,
  input: any,
  progress: SSEProgress,
  ext: InvokeContextExtensions = {},
): Promise<unknown> {
  const { factory } = compileComponent(component);
  const envBag = await buildEnvBag(component.app!.tenantId);
  const secretsBag = buildSecretsBag(component);
  // PLANET-1579: inject generic per-App secret updater so connector code can
  // persist refreshed credentials (OAuth tokens etc.) without core knowing
  // anything about the specific SaaS. liveSecrets keeps ctx.secrets in sync.
  const updateAppSecrets = component.app
    ? buildUpdateAppSecretsCtx({ appId: component.app.id, liveSecrets: secretsBag })
    : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const exports = factory(makeAllowedGlobals(progress), controller.signal);
    const runFn = (exports as any).default ?? (exports as any).run ?? (exports as any).server;
    if (typeof runFn !== 'function') {
      throw new Error('Component has no default, "run", or "server" export');
    }
    const ctx = {
      signal: controller.signal,
      env: envBag,
      secrets: secretsBag,
      updateAppSecrets,
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

/**
 * Synchronous (non-streaming) invocation. Returns { result }.
 * Used by /api/apps/:targetAppId/invoke/:componentId and ctx.callApp.
 */
export async function runComponentSync(
  component: ComponentWithApp,
  input: unknown,
  ext: InvokeContextExtensions = {},
): Promise<{ result: unknown }> {
  const progress: SSEProgress = {
    async step(_name: string) {
      // Code execution progress is event-based, not a visual builder model.
    },
  };
  const result = await runComponentWithProgress(component, input, progress, ext);
  return { result };
}
