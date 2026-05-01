/**
 * Rewrite bare react/react-dom imports — currently a no-op passthrough.
 * React imports are kept as bare specifiers; the client-side preview loader
 * handles shimming them to the host page's React instance via blob URLs.
 * (PLANET-1435)
 */

export function rewriteReactImports(code: string): string {
  // No-op: bare specifiers are intentional — client loader rewrites them
  return code;
}
