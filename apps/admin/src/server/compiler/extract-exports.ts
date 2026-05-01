/**
 * Extract server and Client exports from a .fullstack.tsx source file.
 * Uses regex-based extraction (no babel dependency needed for v1).
 */

export interface ExtractedExports {
  serverBody: string;
  clientBody: string;
  imports: string;
}

export function extractExports(source: string): ExtractedExports {
  // Extract imports (everything before first export)
  const importLines: string[] = [];
  const lines = source.split('\n');
  let i = 0;
  for (; i < lines.length; i++) {
    if (lines[i].match(/^export\s/)) break;
    importLines.push(lines[i]);
  }
  const imports = importLines.join('\n');

  // Extract `export const server = ...` (arrow) or `export [async] function server(...)` (declaration)
  const serverArrowMatch = source.match(
    /export\s+const\s+server\s*=\s*(async\s*)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*\{/
  );
  const serverFnMatch = source.match(
    /export\s+(async\s+)?function\s+server\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/
  );
  const serverMatch = serverArrowMatch ?? serverFnMatch;
  if (!serverMatch) throw new Error('Could not find `export const server` or `export function server` in fullstack source');
  const serverStart = source.indexOf(serverMatch[0]);
  const serverBody = extractBlock(source, serverStart + serverMatch[0].length - 1);

  // Extract `export const Client = ...` (arrow) or `export function Client(...)` (declaration)
  const clientArrowMatch = source.match(
    /export\s+const\s+Client\s*=\s*\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*[\s\S]*?(?=\{)/
  );
  const clientFnMatch = source.match(
    /export\s+function\s+Client\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/
  );
  const clientMatch = clientArrowMatch ?? clientFnMatch;
  if (!clientMatch) throw new Error('Could not find `export const Client` or `export function Client` in fullstack source');
  const clientStart = source.indexOf(clientMatch[0]);
  const clientFnStart = clientArrowMatch
    ? source.indexOf('{', clientStart + clientMatch[0].length - 1)
    : clientStart + clientMatch[0].length - 1;
  const clientBody = extractBlock(source, clientFnStart);

  return {
    serverBody: `export const server = async (ctx) => ${serverBody};`,
    clientBody: `export const Client = ({ data, refresh }) => ${clientBody};`,
    imports,
  };
}

/** Extract a balanced {} block starting at the opening brace position */
function extractBlock(source: string, openBrace: number): string {
  let depth = 0;
  let i = openBrace;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBrace, i + 1);
    }
  }
  throw new Error('Unbalanced braces in source');
}
