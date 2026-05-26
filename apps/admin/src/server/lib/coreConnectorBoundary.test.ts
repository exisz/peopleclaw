import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SERVER_ROOT = new URL('..', import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(SERVER_ROOT, full);
    if (
      rel.startsWith('generated/')
      || rel.startsWith('seed/templates/')
      || rel.includes('api-dist/')
      || entry.endsWith('.test.ts')
      || entry.endsWith('.d.ts')
    ) {
      continue;
    }
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|json)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('Core connector boundary', () => {
  it('TC-PC-090 proves Shopify connector logic is absent from core', () => {
    const offenders = sourceFiles(SERVER_ROOT)
      .map((file) => {
        const body = readFileSync(file, 'utf8');
        return /shopify/i.test(body) ? relative(process.cwd(), file) : null;
      })
      .filter(Boolean);

    assert.deepEqual(
      offenders,
      [],
      'Shopify-specific logic must stay in App artifact templates/connectors, not PeopleClaw core server code',
    );
  });
});
