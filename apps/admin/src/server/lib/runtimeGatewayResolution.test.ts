import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRuntimeFunctionRoute } from './runtimeGatewayResolution';

describe('PeopleClaw runtime gateway route resolution', () => {
  it('TC-PC-021 resolves appId + deployment + function id to a function artifact', () => {
    const route = resolveRuntimeFunctionRoute({
      appId: 'demo-crm',
      deploymentId: 'dep_prod_001',
      functionId: 'functions/createLead.ts',
    }, [{
      appId: 'demo-crm',
      deploymentId: 'dep_prod_001',
      functions: {
        'functions/createLead.ts': {
          functionId: 'functions/createLead.ts',
          artifactHash: 'sha256:create-lead-v1',
          handler: 'createLead',
        },
      },
    }]);

    assert.deepEqual(route, {
      appId: 'demo-crm',
      deploymentId: 'dep_prod_001',
      functionId: 'functions/createLead.ts',
      artifactHash: 'sha256:create-lead-v1',
      handler: 'createLead',
    });
  });

  it('TC-PC-022 rejects an unknown deployment instead of falling back to another artifact', () => {
    const route = resolveRuntimeFunctionRoute({
      appId: 'demo-crm',
      deploymentId: 'dep_missing',
      functionId: 'functions/createLead.ts',
    }, [{
      appId: 'demo-crm',
      deploymentId: 'dep_prod_001',
      functions: {
        'functions/createLead.ts': {
          functionId: 'functions/createLead.ts',
          artifactHash: 'sha256:create-lead-v1',
          handler: 'createLead',
        },
      },
    }]);

    assert.equal(route, null);
  });

});
