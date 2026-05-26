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
      env: { ...process.env, PEOPLECLAW_CONFIG: '/tmp/peopleclaw-cli-audit-test-config.json' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

describe('PeopleClaw CLI audit', () => {
  it('TC-PC-078 proves audit command prints app audit trail', async () => {
    const server = createServer((req, res) => {
      assert.equal(req.url, '/api/external-agent/apps/app_crm/audit');
      assert.equal(req.headers.authorization, 'Bearer pc_m2m_audit_test');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        appId: 'app_crm',
        events: [
          {
            timestamp: '2026-05-26T12:30:00.000Z',
            actor: { id: 'agent_123', name: 'Codex Runner' },
            action: 'deployment.promoted',
            summary: 'Promoted dep_preview_123 to production',
          },
        ],
      }));
    });
    const address = await listen(server);
    try {
      const result = await runPeopleClaw(['audit', 'app_crm', '--base-url', `http://${address.address}:${address.port}`, '--api-key', 'pc_m2m_audit_test']);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /2026-05-26T12:30:00.000Z\tCodex Runner\tdeployment\.promoted\tPromoted dep_preview_123 to production/);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
