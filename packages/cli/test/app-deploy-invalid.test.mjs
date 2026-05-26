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
      env: { ...process.env, PEOPLECLAW_CONFIG: '/tmp/peopleclaw-cli-app-deploy-invalid-test-config.json' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

describe('PeopleClaw CLI app deploy invalid artifact guard', () => {
  it('TC-PC-079 proves deploy refuses dirty invalid artifact', async () => {
    const root = await mkdtemp(join(tmpdir(), 'peopleclaw-app-deploy-invalid-'));
    await mkdir(join(root, 'app/screens'), { recursive: true });
    await writeFile(join(root, 'app/manifest.json'), '{"id":"app_crm"}\n');
    await writeFile(join(root, 'app/screens/customers.tsx'), '<<<<<<< dirty merge conflict\n');

    let requestCount = 0;
    const server = createServer((_req, res) => {
      requestCount += 1;
      res.statusCode = 500;
      res.end('deploy should not be called');
    });
    const address = await listen(server);
    try {
      const result = await runPeopleClaw(['app', 'deploy', 'app_crm', '--preview', '--dir', root, '--base-url', `http://${address.address}:${address.port}`, '--api-key', 'pc_m2m_deploy_invalid_test']);

      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /Refusing to deploy invalid app artifact/);
      assert.match(result.stderr, /app\/manifest\.json must include name/);
      assert.match(result.stderr, /artifact file appears dirty or conflicted: app\/screens\/customers\.tsx/);
      assert.equal(requestCount, 0);
    } finally {
      await new Promise(resolve => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });
});
