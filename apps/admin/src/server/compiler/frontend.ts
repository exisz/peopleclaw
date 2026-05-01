/**
 * Frontend compiler — compiles a FRONTEND component's client-only code into
 * an ESM bundle that exports a default React component.
 * (PLANET-1428, PLANET-1432, PLANET-1435)
 *
 * React is NOT bundled — marked external and rewritten to esm.sh CDN imports
 * so compilation works in Vercel serverless (no node_modules fs access).
 */

import { buildSync } from 'esbuild';
import { rewriteReactImports } from './rewrite-react-imports.js';

export interface FrontendCompileResult {
  clientBundle: string;
  compiledAt: string;
}

export function compileFrontend(source: string, _componentId: string): FrontendCompileResult {
  const result = buildSync({
    stdin: {
      contents: source,
      loader: 'tsx',
    },
    bundle: true,
    format: 'esm',
    target: 'es2020',
    minify: false,
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    write: false,
  });

  return {
    clientBundle: rewriteReactImports(result.outputFiles[0].text),
    compiledAt: new Date().toISOString(),
  };
}
