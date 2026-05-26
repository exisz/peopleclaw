import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address())));
}

function runPeopleClaw(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['packages/cli/dist/index.js', ...args], {
      cwd: new URL('../../..', import.meta.url),
      env: { ...process.env, PEOPLECLAW_CONFIG: '/tmp/peopleclaw-cli-app-pull-test-config.json' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

describe('PeopleClaw CLI app pull', () => {
  it('TC-PC-073 proves peopleclaw app pull writes repo-like tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'peopleclaw-app-pull-'));
    const server = createServer((req, res) => {
      assert.equal(req.url, '/api/external-agent/apps/app_crm');
      assert.equal(req.headers.authorization, 'Bearer pc_m2m_pull_test');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        app: { id: 'app_crm', name: 'CRM' },
        appTree: {
          files: {
            'app/manifest.json': { id: 'app_crm', name: 'CRM' },
            'app/sidebar.json5': '{ items: [{ label: "Customers", screen: "customers" }] }\n',
            'app/screens/customers.tsx': 'export default function Customers() { return <h1>Customers</h1>; }\n',
            'app/functions/createCustomer.ts': 'export async function handler() { return { ok: true }; }\n',
          },
        },
      }));
    });
    const address = await listen(server);
    try {
      const result = await runPeopleClaw(['app', 'pull', 'app_crm', '--dir', root, '--base-url', `http://${address.address}:${address.port}`, '--api-key', 'pc_m2m_pull_test']);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /Wrote 4 files/);
      assert.deepEqual(JSON.parse(await readFile(join(root, 'app/manifest.json'), 'utf8')), { id: 'app_crm', name: 'CRM' });
      assert.match(await readFile(join(root, 'app/sidebar.json5'), 'utf8'), /Customers/);
      assert.match(await readFile(join(root, 'app/screens/customers.tsx'), 'utf8'), /<h1>Customers<\/h1>/);
      assert.match(await readFile(join(root, 'app/functions/createCustomer.ts'), 'utf8'), /handler/);
    } finally {
      await new Promise(resolve => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });
});
