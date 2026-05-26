import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRuntimeFunctionContext } from './runtimeFunctionContext';

describe('PeopleClaw runtime function context', () => {
  it('TC-PC-023 injects auth user context and app context into a function', () => {
    const ctx = buildRuntimeFunctionContext({
      tenantId: 'tenant_123',
      authUser: {
        userId: 'user_456',
        email: 'agent@example.com',
        roles: ['owner'],
      },
      route: {
        appId: 'demo-crm',
        deploymentId: 'dep_prod_001',
        functionId: 'functions/createLead.ts',
        artifactHash: 'sha256:create-lead-v1',
        handler: 'createLead',
      },
    });

    assert.deepEqual(ctx.auth.user, {
      userId: 'user_456',
      email: 'agent@example.com',
      roles: ['owner'],
    });
    assert.deepEqual(ctx.app, {
      tenantId: 'tenant_123',
      appId: 'demo-crm',
      deploymentId: 'dep_prod_001',
      functionId: 'functions/createLead.ts',
    });
  });
});
