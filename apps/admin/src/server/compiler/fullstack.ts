/**
 * Fullstack compiler — compiles a .fullstack.tsx source into:
 * 1. serverHandler (ESM string)
 * 2. clientBundle (ESM string for browser)
 * 3. probes (JSON object)
 * (PLANET-1435: React externalized → esm.sh CDN, no resolveDir needed)
 */

import { buildSync, transformSync } from 'esbuild';
import { extractExports } from './extract-exports.js';
import { injectGlue } from './inject-glue.js';
import { distillProbes } from './distill-probes.js';
import { rewriteReactImports } from './rewrite-react-imports.js';

// process.cwd() = monorepo root where node_modules lives

export interface CompileResult {
  serverHandler: string;
  clientBundle: string;
  probes: { nodes: string[]; order: string[] };
  compiledAt: string;
}

export function compileFullstack(source: string, componentId: string): CompileResult {
  const { serverBody, clientBody, imports } = extractExports(source);

  // Build server handler — strip SDK import, inline peopleClaw stub
  const sdkStub = `
const peopleClaw = { async nodeEntry(node) { console.log('[peopleclaw:probe] enter ' + node + ' @ ' + Date.now()); } };
`;
  // Remove import lines that reference @peopleclaw/sdk
  const serverImports = imports.split('\n').filter(l => !l.includes('@peopleclaw/sdk')).join('\n');
  const serverSource = `${serverImports}\n${sdkStub}\n${serverBody}\nexport default server;`;
  const serverResult = transformSync(serverSource, {
    loader: 'tsx',
    format: 'esm',
    target: 'node18',
    minify: false,
  });
  const serverHandler = serverResult.code;

  // Build client bundle with glue — bundled so React is inlined for browser
  const clientWithGlue = injectGlue(clientBody, componentId);
  const clientBuildResult = buildSync({
    stdin: {
      contents: clientWithGlue,
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
  const clientBundle = rewriteReactImports(clientBuildResult.outputFiles[0].text);

  // Extract probes
  const probes = distillProbes(source);

  return {
    serverHandler,
    clientBundle,
    probes,
    compiledAt: new Date().toISOString(),
  };
}
