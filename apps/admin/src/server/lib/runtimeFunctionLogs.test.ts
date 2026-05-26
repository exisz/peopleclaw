import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRuntimeFunctionLogger } from './runtimeFunctionLogs';

describe('PeopleClaw runtime function logs', () => {
  it('TC-PC-030 proves function logs include invocation/deployment id', () => {
    const logger = createRuntimeFunctionLogger({
      invocationId: 'inv_123',
      deploymentId: 'dep_prod_001',
      functionId: 'functions/createLead.ts',
      now: () => new Date('2026-05-26T06:00:00.000Z'),
    });

    const entry = logger.info('Created lead', { leadId: 'lead_123' });

    assert.deepEqual(entry, {
      level: 'info',
      message: 'Created lead',
      invocationId: 'inv_123',
      deploymentId: 'dep_prod_001',
      functionId: 'functions/createLead.ts',
      timestamp: '2026-05-26T06:00:00.000Z',
      data: { leadId: 'lead_123' },
    });
    assert.deepEqual(logger.entries, [entry]);
  });
});
