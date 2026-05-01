/**
 * Frontend compiler — compiles a FRONTEND component's client-only code into
 * an ESM bundle that exports a default React component.
 * (PLANET-1428, PLANET-1432)
 */

import { buildSync } from 'esbuild';

export interface FrontendCompileResult {
  clientBundle: string;
  compiledAt: string;
}

export function compileFrontend(source: string, _componentId: string): FrontendCompileResult {
  // FRONTEND code is pure client — bundle with React inlined so browser can execute standalone ESM
  const result = buildSync({
    stdin: {
      contents: source,
      loader: 'tsx',
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: 'esm',
    target: 'es2020',
    minify: false,
    jsx: 'automatic',
    write: false,
  });

  return {
    clientBundle: result.outputFiles[0].text,
    compiledAt: new Date().toISOString(),
  };
}
