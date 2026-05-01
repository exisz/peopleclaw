/**
 * Frontend compiler — compiles a FRONTEND component's client-only code into
 * an ESM bundle that exports a default React component.
 * (PLANET-1428)
 */

import { transformSync } from 'esbuild';

export interface FrontendCompileResult {
  clientBundle: string;
  compiledAt: string;
}

export function compileFrontend(source: string, _componentId: string): FrontendCompileResult {
  // FRONTEND code is pure client — transpile TSX → ESM
  // Same jsx strategy as fullstack compiler for consistency
  const result = transformSync(source, {
    loader: 'tsx',
    format: 'esm',
    target: 'es2020',
    minify: false,
    jsx: 'automatic',
  });

  return {
    clientBundle: result.code,
    compiledAt: new Date().toISOString(),
  };
}
