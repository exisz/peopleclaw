import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createScopedAppNotFoundBody } from './scopedNotFound';

describe('PeopleClaw scoped app 404 responses', () => {
  it('TC-PC-012 returns a scoped 404 body for unknown app ids without leaking data', () => {
    const body = createScopedAppNotFoundBody();

    assert.deepEqual(body, { error: 'not_found', message: 'App not found' });
    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /unknown-app|appId|tenantId|deployment|manifest|candidate/i);
  });
});
