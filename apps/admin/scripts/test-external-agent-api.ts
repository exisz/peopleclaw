import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tmp = mkdtempSync(join(tmpdir(), 'peopleclaw-agent-api-'));
const dbPath = join(tmp, 'test.db');
process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
process.env.DATABASE_URL = process.env.LOCAL_DATABASE_URL;
process.env.E2E_SECRET = 'external-agent-api-test-secret';
process.env.NODE_ENV = 'test';

try {
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate'], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });

  const { createApp } = await import('../src/server/app.js');
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  assert(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/api`;
  const userAuth = { Authorization: `Bearer e2e:${process.env.E2E_SECRET}:external-agent-api-test-user` };

  async function json(path: string, init: RequestInit = {}) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }

  const me = await json('/me', { headers: userAuth });
  assert.equal(me.res.status, 200);
  assert.equal(Array.isArray(me.body.tenants), true);

  const created = await json('/external-agent-keys', {
    method: 'POST',
    headers: userAuth,
    body: JSON.stringify({ name: 'local codex', scopes: ['agent:read', 'app:read', 'component:write'] }),
  });
  assert.equal(created.res.status, 201, JSON.stringify(created.body));
  assert.match(created.body.token, /^pc_m2m_[a-f0-9]{10}_/);
  assert.equal(created.body.key.tokenHash, undefined);

  const tokenAuth = { Authorization: `Bearer ${created.body.token}` };
  const whoami = await json('/external-agent/whoami', { headers: tokenAuth });
  assert.equal(whoami.res.status, 200, JSON.stringify(whoami.body));
  assert.equal(whoami.body.externalAgent.keyId, created.body.key.id);

  const rawSqlDenied = await json('/external-agent/safety/check', {
    method: 'POST',
    headers: tokenAuth,
    body: JSON.stringify({ operation: 'raw_sql', dryRun: true, confirmed: true }),
  });
  assert.equal(rawSqlDenied.res.status, 403);
  assert.equal(rawSqlDenied.body.decision.reason, 'denylisted_operation');

  const listed = await json('/external-agent-keys', { headers: userAuth });
  assert.equal(listed.res.status, 200);
  assert.equal(listed.body.keys.length, 1);
  assert.equal(listed.body.keys[0].token, undefined);
  assert.equal(listed.body.keys[0].tokenHash, undefined);

  const revoked = await json(`/external-agent-keys/${created.body.key.id}`, { method: 'DELETE', headers: userAuth });
  assert.equal(revoked.res.status, 200);
  assert.ok(revoked.body.key.revokedAt);

  const afterRevoke = await json('/external-agent/whoami', { headers: tokenAuth });
  assert.equal(afterRevoke.res.status, 401);

  const invalid = await json('/external-agent/whoami', { headers: { Authorization: 'Bearer pc_m2m_0000000000_invalidinvalidinvalidinvalid' } });
  assert.equal(invalid.res.status, 401);

  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  console.log('[test-external-agent-api] ok');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
