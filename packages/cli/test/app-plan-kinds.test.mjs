import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
      env: { ...process.env, PEOPLECLAW_CONFIG: '/tmp/peopleclaw-cli-app-plan-kinds-test-config.json' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

describe('PeopleClaw CLI app plan change kinds', () => {
  it('TC-PC-075 proves plan detects screen/function/data changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'peopleclaw-app-plan-kinds-'));
    await mkdir(join(root, 'app/screens'), { recursive: true });
    await mkdir(join(root, 'app/functions'), { recursive: true });
    await mkdir(join(root, 'app/data'), { recursive: true });
    await writeFile(join(root, 'app/screens/customers.tsx'), 'export default function Customers() { return <h1>Edited</h1>; }\n');
    await writeFile(join(root, 'app/functions/createCustomer.ts'), 'export async function handler() { return { ok: true, edited: true }; }\n');
    await writeFile(join(root, 'app/data/collections.json5'), '{ collections: [{ name: "customers", fields: ["name", "email"] }] }\n');

    const server = createServer((req, res) => {
      assert.equal(req.url, '/api/external-agent/apps/app_crm');
      assert.equal(req.headers.authorization, 'Bearer pc_m2m_plan_kinds_test');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        appTree: {
          files: {
            'app/screens/customers.tsx': 'export default function Customers() { return <h1>Customers</h1>; }\n',
            'app/functions/createCustomer.ts': 'export async function handler() { return { ok: true }; }\n',
            'app/data/collections.json5': '{ collections: [{ name: "customers", fields: ["name"] }] }\n',
          },
        },
      }));
    });
    const address = await listen(server);
    try {
      const result = await runPeopleClaw(['app', 'plan', 'app_crm', '--dir', root, '--json', '--base-url', `http://${address.address}:${address.port}`, '--api-key', 'pc_m2m_plan_kinds_test']);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      const body = JSON.parse(result.stdout);
      assert.deepEqual(body.changes.map(change => [change.status, change.kind, change.path]), [
        ['modified', 'data', 'app/data/collections.json5'],
        ['modified', 'function', 'app/functions/createCustomer.ts'],
        ['modified', 'screen', 'app/screens/customers.tsx'],
      ]);
    } finally {
      await new Promise(resolve => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });
});
