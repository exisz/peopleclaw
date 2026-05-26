import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address())));
}

function runPeopleClaw(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['packages/cli/dist/index.js', ...args], {
      cwd: new URL('../../..', import.meta.url),
      env: { ...process.env, PEOPLECLAW_CONFIG: '/tmp/peopleclaw-cli-apps-list-test-config.json' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

describe('PeopleClaw CLI apps list', () => {
  it('TC-PC-072 proves peopleclaw apps list returns scoped apps', async () => {
    const server = createServer((req, res) => {
      assert.equal(req.url, '/api/external-agent/apps');
      assert.equal(req.headers.authorization, 'Bearer pc_m2m_scoped_test');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        tenant: { id: 'tenant_123', name: 'Demo Tenant' },
        apps: [
          { id: 'app_crm', name: 'CRM', tenantId: 'tenant_123' },
          { id: 'app_support', name: 'Support Desk', tenantId: 'tenant_123' },
        ],
      }));
    });
    const address = await listen(server);
    try {
      const result = await runPeopleClaw(['apps', 'list', '--base-url', `http://${address.address}:${address.port}`, '--api-key', 'pc_m2m_scoped_test']);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /app_crm\tCRM/);
      assert.match(result.stdout, /app_support\tSupport Desk/);
      assert.doesNotMatch(result.stdout, /other_tenant/);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
