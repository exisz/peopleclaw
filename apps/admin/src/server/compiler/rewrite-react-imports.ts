/**
 * Rewrite bare react/react-dom imports to esm.sh CDN URLs.
 * This allows client bundles to work in the browser without an importmap.
 * (PLANET-1435)
 */

const REACT_VERSION = '19';

const REWRITES: [RegExp, string][] = [
  [/from\s+["']react\/jsx-dev-runtime["']/g, `from "https://esm.sh/react@${REACT_VERSION}/jsx-dev-runtime"`],
  [/from\s+["']react\/jsx-runtime["']/g, `from "https://esm.sh/react@${REACT_VERSION}/jsx-runtime"`],
  [/from\s+["']react-dom["']/g, `from "https://esm.sh/react-dom@${REACT_VERSION}"`],
  [/from\s+["']react["']/g, `from "https://esm.sh/react@${REACT_VERSION}"`],
];

export function rewriteReactImports(code: string): string {
  let result = code;
  for (const [pattern, replacement] of REWRITES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
