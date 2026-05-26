import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planRuntimeJobDispatch } from './runtimeJobQueue';

describe('PeopleClaw runtime job queue policy', () => {
  it('TC-PC-069 proves long-running job moves to queue', () => {
    const inline = planRuntimeJobDispatch({
      invocationId: 'inv_short_001',
      deploymentId: 'dep_demo-crm_prod_001',
      estimatedDurationMs: 250,
      inlineBudgetMs: 1_000,
    });
    const queued = planRuntimeJobDispatch({
      invocationId: 'inv_long_001',
      deploymentId: 'dep_demo-crm_prod_001',
      estimatedDurationMs: 30_000,
      inlineBudgetMs: 1_000,
    });

    assert.deepEqual(inline, {
      mode: 'inline',
      invocationId: 'inv_short_001',
      deploymentId: 'dep_demo-crm_prod_001',
    });
    assert.deepEqual(queued, {
      mode: 'queued',
      invocationId: 'inv_long_001',
      deploymentId: 'dep_demo-crm_prod_001',
      queueName: 'runtime-long-running',
      reason: 'estimated_duration_exceeds_inline_budget',
    });
  });
});
