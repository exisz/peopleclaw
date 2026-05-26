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
      env: { ...process.env, PEOPLECLAW_CONFIG: '/tmp/peopleclaw-cli-app-deploy-preview-test-config.json' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

describe('PeopleClaw CLI app deploy preview', () => {
  it('TC-PC-076 proves deploy --preview uploads artifact and returns URL', async () => {
    const root = await mkdtemp(join(tmpdir(), 'peopleclaw-app-deploy-preview-'));
    await mkdir(join(root, 'app/screens'), { recursive: true });
    await writeFile(join(root, 'app/manifest.json'), '{"id":"app_crm","name":"CRM"}\n');
    await writeFile(join(root, 'app/screens/customers.tsx'), 'export default function Customers() { return <h1>Customers</h1>; }\n');

    const server = createServer((req, res) => {
      assert.equal(req.method, 'POST');
      assert.equal(req.url, '/api/external-agent/apps/app_crm/deploy');
      assert.equal(req.headers.authorization, 'Bearer pc_m2m_deploy_test');
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        assert.equal(parsed.preview, true);
        assert.equal(parsed.artifact.files['app/manifest.json'], '{"id":"app_crm","name":"CRM"}\n');
        assert.match(parsed.artifact.files['app/screens/customers.tsx'], /Customers/);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ deployment: { id: 'dep_preview_123', previewUrl: 'https://preview.peopleclaw.test/apps/app_crm' } }));
      });
    });
    const address = await listen(server);
    try {
      const result = await runPeopleClaw(['app', 'deploy', 'app_crm', '--preview', '--dir', root, '--base-url', `http://${address.address}:${address.port}`, '--api-key', 'pc_m2m_deploy_test']);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /https:\/\/preview\.peopleclaw\.test\/apps\/app_crm/);
    } finally {
      await new Promise(resolve => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });
});
