import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateToken, JsonTokenStore, parseToken } from '../src/core/index.js';

test('token generation parses and authenticates from the JSON store', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pcv-token-'));
  const store = new JsonTokenStore(path.join(tmp, 'tokens.json'));
  const issued = await store.issue({ label: 'skin-spirit', allowedProjects: ['skin-spirit'], allowedRepos: ['exisz/skin-spirit'] });
  assert.ok(issued.token.startsWith('pcv_'));
  assert.equal(issued.record.secretHash.length, 64);
  const authed = await store.authenticate(issued.token);
  assert.equal(authed?.label, 'skin-spirit');
  assert.deepEqual(authed?.allowedProjects, ['skin-spirit']);
  assert.equal(await store.authenticate(`${issued.token}x`), null);
});

test('generated token format is opaque and split into id plus secret', () => {
  const token = generateToken();
  const parsed = parseToken(token.full);
  assert.equal(parsed?.id, token.id);
  assert.equal(parsed?.secret, token.secret);
});
