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

  // Extract `export const server = ...` block
  const serverMatch = source.match(
    /export\s+const\s+server\s*=\s*(async\s*)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*\{/
  );
  if (!serverMatch) throw new Error('Could not find `export const server` in fullstack source');
  const serverStart = source.indexOf(serverMatch[0]);
  const serverBody = extractBlock(source, serverStart + serverMatch[0].length - 1);

  // Extract `export const Client = ...` block
  const clientMatch = source.match(
    /export\s+const\s+Client\s*=\s*\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*[\s\S]*?(?=\{)/
  );
  if (!clientMatch) throw new Error('Could not find `export const Client` in fullstack source');
  const clientStart = source.indexOf(clientMatch[0]);
  const clientFnStart = source.indexOf('{', clientStart + clientMatch[0].length - 1);
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
