import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCoreAppShellRoute } from './appRouteResolution';

describe('PeopleClaw core app shell route resolution', () => {
  it('TC-PC-011 resolves /apps/:appId/* through the core shell namespace', () => {
    assert.deepEqual(resolveCoreAppShellRoute('/apps/demo-crm/dashboard'), {
      appId: 'demo-crm',
      appPath: '/dashboard',
    });

    assert.equal(resolveCoreAppShellRoute('/apps'), null);
    assert.equal(resolveCoreAppShellRoute('/settings'), null);
  });
});
