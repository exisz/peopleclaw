import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { invokeRuntimeFunctionWorkerSource } from './runtimeFunctionExecutor';

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

});
