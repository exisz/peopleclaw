/**
 * Fullstack compiler — compiles a .fullstack.tsx source into:
 * 1. serverHandler (ESM string)
 * 2. clientBundle (ESM string for browser)
 * 3. probes (JSON object)
 */

import { transformSync } from 'esbuild';
import { extractExports } from './extract-exports.js';
import { injectGlue } from './inject-glue.js';
import { distillProbes } from './distill-probes.js';

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

  // Build client bundle with glue
  const clientWithGlue = injectGlue(clientBody, componentId);
  const clientResult = transformSync(clientWithGlue, {
    loader: 'tsx',
    format: 'esm',
    target: 'es2020',
    minify: false,
    // React JSX preserved — consumer must have React available
    jsx: 'automatic',
  });
  const clientBundle = clientResult.code;

  // Extract probes
  const probes = distillProbes(source);

  return {
    serverHandler,
    clientBundle,
    probes,
    compiledAt: new Date().toISOString(),
  };
}
