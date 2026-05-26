import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createScreenSdkContext } from './screenSdkContext';

describe('PeopleClaw screen SDK context', () => {
  it('TC-PC-018 carries tenant/app/deployment context into a screen', () => {
    const context = createScreenSdkContext({
      tenantId: 'tenant_123',
      appId: 'demo-crm',
      deploymentId: 'dep_prod_456',
      channel: 'production',
      screenId: 'screens/Dashboard.tsx',
      appPath: 'dashboard',
    });

    assert.deepEqual(context, {
      tenantId: 'tenant_123',
      appId: 'demo-crm',
      deploymentId: 'dep_prod_456',
      channel: 'production',
      screenId: 'screens/Dashboard.tsx',
      appPath: '/dashboard',
    });
  });

  it('rejects missing scoped identity instead of letting screens infer it', () => {
    assert.throws(() => createScreenSdkContext({
      tenantId: 'tenant_123',
      appId: ' ',
      deploymentId: 'dep_prod_456',
      channel: 'production',
      screenId: 'screens/Dashboard.tsx',
      appPath: '/dashboard',
    }), /requires appId/);
  });
});
