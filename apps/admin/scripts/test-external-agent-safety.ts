import assert from 'node:assert/strict';
import {
  createExternalAgentToken,
  extractExternalAgentTokenPrefix,
  hashExternalAgentToken,
  publicExternalAgentKey,
  verifyExternalAgentTokenRecord,
} from '../src/server/lib/externalAgentTokens.js';
import {
  evaluateExternalAgentOperation,
  normalizeExternalAgentScopes,
  parseStoredExternalAgentScopes,
} from '../src/server/lib/externalAgentSafety.js';

const minted = createExternalAgentToken();
assert.equal(extractExternalAgentTokenPrefix(minted.token), minted.prefix);
assert.equal(minted.tokenHash, hashExternalAgentToken(minted.token));

const record = {
  id: 'key_1',
  tenantId: 'tenant_1',
  appId: 'app_1',
  name: 'Codex local',
  prefix: minted.prefix,
  tokenHash: minted.tokenHash,
  scopes: JSON.stringify(['agent:read', 'app:read', 'component:write']),
  createdAt: new Date('2026-05-21T00:00:00Z'),
  updatedAt: new Date('2026-05-21T00:00:00Z'),
  lastUsedAt: null,
  revokedAt: null,
};

const verified = verifyExternalAgentTokenRecord(minted.token, record);
assert.deepEqual(verified.scopes, ['agent:read', 'app:read', 'component:write']);
assert.equal(verified.tenantId, 'tenant_1');
assert.equal(verified.appId, 'app_1');

assert.throws(
  () => verifyExternalAgentTokenRecord(`${minted.token}x`, record),
  /invalid external agent token/,
  'mutated token must fail hash verification',
);
assert.throws(
  () => verifyExternalAgentTokenRecord(minted.token, { ...record, revokedAt: new Date() }),
  /revoked/,
  'revoked token must fail',
);

assert.deepEqual(normalizeExternalAgentScopes(['agent:read', 'agent:read', 'component:run']), ['agent:read', 'component:run']);
assert.deepEqual(parseStoredExternalAgentScopes('["agent:read"]'), ['agent:read']);
assert.throws(() => normalizeExternalAgentScopes(['raw_sql']), /invalid external agent scope/);

const publicKey = publicExternalAgentKey(record);
assert.equal(Object.prototype.hasOwnProperty.call(publicKey, 'tokenHash'), false, 'public list must not leak token hash');
assert.equal(Object.prototype.hasOwnProperty.call(publicKey, 'token'), false, 'public list must not leak token');

const denylisted = evaluateExternalAgentOperation({ operation: 'raw_sql', scopes: ['agent:read'], dryRun: true, confirmed: true });
assert.equal(denylisted.allowed, false);
assert.equal(denylisted.reason, 'denylisted_operation');

const missingScope = evaluateExternalAgentOperation({ operation: 'update_app_component', scopes: ['agent:read'], dryRun: true });
assert.equal(missingScope.allowed, false);
assert.equal(missingScope.reason, 'missing_scope');

const needsConfirm = evaluateExternalAgentOperation({ operation: 'update_app_component', scopes: ['component:write'] });
assert.equal(needsConfirm.allowed, false);
assert.equal(needsConfirm.reason, 'confirmation_required');

const dryRunAllowed = evaluateExternalAgentOperation({ operation: 'update_app_component', scopes: ['component:write'], dryRun: true });
assert.equal(dryRunAllowed.allowed, true);

const confirmedAllowed = evaluateExternalAgentOperation({ operation: 'update_app_component', scopes: ['component:write'], confirmed: true });
assert.equal(confirmedAllowed.allowed, true);

console.log('[test-external-agent-safety] ok');
