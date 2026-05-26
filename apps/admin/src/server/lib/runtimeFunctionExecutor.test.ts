import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { invokeRuntimeFunctionWorkerSource, recordRuntimeInvocationOutcome } from './runtimeFunctionExecutor';

describe('PeopleClaw runtime function executor limits', () => {
  it('TC-PC-061 proves infinite loop function is killed by timeout', async () => {
    const accepted = await invokeRuntimeFunctionWorkerSource({
      source: `(input) => ({ message: 'ok', input })`,
      payload: { id: 'lead_123' },
      timeoutMs: 500,
    });
    assert.deepEqual(accepted, { ok: true, result: { message: 'ok', input: { id: 'lead_123' } } });

    const rejected = await invokeRuntimeFunctionWorkerSource({
      source: `() => { while (true) {} }`,
      timeoutMs: 50,
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.stage, 'timeout');
    assert.match(rejected.errors.join('\n'), /exceeded timeout/);
  });

  it('TC-PC-062 proves memory hog function is killed by memory limit', async () => {
    const rejected = await invokeRuntimeFunctionWorkerSource({
      source: `() => { const chunks = []; while (true) chunks.push(new Array(1_000_000).fill('peopleclaw')); }`,
      timeoutMs: 2_000,
      memoryLimitMb: 16,
    });

    assert.equal(rejected.ok, false);
    assert.equal(rejected.stage, 'memory');
    assert.match(rejected.errors.join('\n'), /exceeded memory limit/);
  });


  it('TC-PC-068 proves worker crash marks invocation failed not deployment corrupt', async () => {
    const workerResult = await invokeRuntimeFunctionWorkerSource({
      source: `() => { process.exit(1); }`,
      timeoutMs: 500,
    });

    const outcome = recordRuntimeInvocationOutcome({
      invocationId: 'inv_crashed_001',
      deploymentId: 'dep_demo-crm_prod_001',
      workerResult,
    });

    assert.equal(workerResult.ok, false);
    assert.equal(workerResult.stage, 'runtime');
    assert.match(workerResult.errors.join('\n'), /runtime worker exited with code 1/);
    assert.deepEqual(outcome, {
      invocationId: 'inv_crashed_001',
      deploymentId: 'dep_demo-crm_prod_001',
      invocationStatus: 'failed',
      deploymentStatus: 'unchanged',
      errors: ['runtime worker exited with code 1'],
    });
  });

  it('TC-PC-063 proves CPU-heavy function hits configured limit', async () => {
    const rejected = await invokeRuntimeFunctionWorkerSource({
      source: `() => { let total = 0; while (true) total += Math.sqrt(total + 1); }`,
      timeoutMs: 1_000,
      cpuLimitMs: 50,
    });

    assert.equal(rejected.ok, false);
    assert.equal(rejected.stage, 'cpu');
    assert.match(rejected.errors.join('\n'), /exceeded CPU limit/);
  });

});
