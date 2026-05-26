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
      env: { ...process.env, PEOPLECLAW_CONFIG: '/tmp/peopleclaw-cli-logs-test-config.json' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

describe('PeopleClaw CLI logs', () => {
  it('TC-PC-077 proves logs command filters by app/deployment', async () => {
    const server = createServer((req, res) => {
      assert.equal(req.url, '/api/external-agent/apps/app_crm/logs?deploymentId=dep_preview_123');
      assert.equal(req.headers.authorization, 'Bearer pc_m2m_logs_test');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        appId: 'app_crm',
        deploymentId: 'dep_preview_123',
        logs: [
          { timestamp: '2026-05-26T12:00:00.000Z', level: 'info', message: 'preview booted' },
        ],
      }));
    });
    const address = await listen(server);
    try {
      const result = await runPeopleClaw(['logs', 'app_crm', '--deployment-id', 'dep_preview_123', '--base-url', `http://${address.address}:${address.port}`, '--api-key', 'pc_m2m_logs_test']);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /2026-05-26T12:00:00.000Z\tinfo\tpreview booted/);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
