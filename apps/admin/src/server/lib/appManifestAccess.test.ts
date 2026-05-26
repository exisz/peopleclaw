import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readTenantScopedAppManifest } from './appManifestAccess';

describe('PeopleClaw tenant-scoped app manifest access', () => {
  const records = [
    {
      appId: 'crm-a',
      tenantId: 'tenant-a',
      manifest: { appId: 'crm-a', name: 'Tenant A CRM', routes: [{ id: 'home' }] },
    },
    {
      appId: 'crm-b',
      tenantId: 'tenant-b',
      manifest: { appId: 'crm-b', name: 'Tenant B CRM', routes: [{ id: 'secret-b' }] },
    },
  ];

  it('TC-PC-051 proves tenant A cannot read tenant B manifest', () => {
    const allowed = readTenantScopedAppManifest({ requestingTenantId: 'tenant-a', appId: 'crm-a', records });
    const denied = readTenantScopedAppManifest({ requestingTenantId: 'tenant-a', appId: 'crm-b', records });

    assert.equal(allowed.ok, true);
    if (allowed.ok) assert.equal(allowed.manifest.name, 'Tenant A CRM');

    assert.deepEqual(denied, { ok: false, status: 404, body: { error: 'not_found', message: 'App not found' } });
    const serializedDenied = JSON.stringify(denied);
    assert.doesNotMatch(serializedDenied, /Tenant B CRM|secret-b|tenant-b|crm-b|manifest/i);
  });
});
