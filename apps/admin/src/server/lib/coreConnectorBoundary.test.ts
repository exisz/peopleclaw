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

  it('TC-PC-114 proves Shopify client logic is absent from core routes, cron, env, and settings surfaces', () => {
    const adminRoot = process.cwd();
    const sensitiveRoots = [
      'src/server/routes',
      'src/server/app.ts',
      'src/server/lib',
      'src/client',
      'scripts',
      'package.json',
    ];
    const allowedScriptFiles = new Set([
      // Legacy E2E data fixtures may mention historical workflows, but they are
      // not core routes, cron, env schema, or settings surfaces.
      'scripts/seed-e2e.mjs',
      'scripts/migrate-add-is-system.mjs',
      'scripts/completion-gate-starter-coverage.test.mjs',
    ]);
    const coreSurfaceFiles = sensitiveRoots.flatMap((entry) => {
      const full = join(adminRoot, entry);
      if (!statSync(full).isDirectory()) return [full];
      return sourceFiles(full).filter((file) => {
        const rel = relative(adminRoot, file);
        if (allowedScriptFiles.has(rel)) return false;
        if (rel.includes('/seed/templates/')) return false;
        if (rel.endsWith('.test.ts') || rel.endsWith('.test.mjs') || rel.endsWith('.d.ts')) return false;
        return /(^apps-admin-never$)|routes|settings|env|cron|schedule|app|lib|client/.test(rel.replaceAll('/', '-'));
      });
    });

    const hardcodedConnectorPatterns = [
      /shopify/i,
      /SHOPIFY_[A-Z0-9_]+/,
      /X-Shopify-Access-Token/i,
      /shopify\.(list_product|publish|sync)/i,
      /publish_shopify/i,
      /shopify[_-](connector|cron|client|auth|route|handler)/i,
    ];
    const offenders = coreSurfaceFiles
      .map((file) => {
        const body = readFileSync(file, 'utf8');
        const match = hardcodedConnectorPatterns.find((pattern) => pattern.test(body));
        return match ? `${relative(adminRoot, file)} :: ${match}` : null;
      })
      .filter(Boolean);

    assert.deepEqual(
      offenders,
      [],
      'Shopify client logic must not be hardcoded in core routes, cron/scheduled jobs, env schema, or settings UI; it belongs in starter App artifacts/connectors.',
    );
  });

});
