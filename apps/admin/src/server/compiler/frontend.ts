/**
 * Frontend compiler — compiles a FRONTEND component's client-only code into
 * an ESM bundle that exports a default React component.
 * (PLANET-1428)
 */

import { buildSync } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve node_modules from the admin app root
const NODE_MODULES = resolve(__dirname, '..', '..', '..', '..', 'node_modules');

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
      resolveDir: NODE_MODULES,
    },
    bundle: true,
    format: 'esm',
    target: 'es2020',
    minify: false,
    jsx: 'automatic',
    write: false,
    nodePaths: [NODE_MODULES],
  });

  return {
    clientBundle: result.outputFiles[0].text,
    compiledAt: new Date().toISOString(),
  };
}
