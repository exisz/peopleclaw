import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createServer } from '../src/server/index.js';
import { JsonTokenStore } from '../src/core/index.js';

test('health and admin token issuance work without exposing upstream token', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pcv-server-'));
  const port = 19000 + Math.floor(Math.random() * 1000);
  const config = {
    storePath: path.join(tmp, 'tokens.json'),
    adminSecret: 'admin-secret-that-is-long',
    vercelToken: 'vercel-secret-token',
    vercelTeamId: null,
    port,
    host: '127.0.0.1',
    publicUrl: null,
    auditLogPath: path.join(tmp, 'audit.jsonl'),
  };
  const server = createServer(config);
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    const issued = await fetch(`http://127.0.0.1:${port}/admin/tokens`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.adminSecret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'skin-spirit', allowedProjects: ['skin-spirit'] }),
    });
    assert.equal(issued.status, 201);
    const payload = await issued.json() as { token: string; record: { secretHash?: string } };
    assert.ok(payload.token.startsWith('pcv_'));
    assert.equal(payload.record.secretHash, undefined);
    assert.equal(JSON.stringify(payload).includes(config.vercelToken), false);

    const whoami = await fetch(`http://127.0.0.1:${port}/whoami`, { headers: { authorization: `Bearer ${payload.token}` } });
    assert.equal(whoami.status, 200);

    const store = new JsonTokenStore(config.storePath);
    const safe = await store.listSafe();
    assert.equal(safe[0].secretHash, 'redacted');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
