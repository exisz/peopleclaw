import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCancellableRuntimeProgressEmitter, createRuntimeProgressEmitter, serializeScopedProgressSse } from './runtimeProgressEvents';

describe('PeopleClaw runtime function progress events', () => {
  it('TC-PC-026 lets a function emit a scoped progress event', () => {
    const progress = createRuntimeProgressEmitter('inv_123', () => new Date('2026-05-26T05:00:00.000Z'));

    const event = progress.emit('Imported first batch', { imported: 25 });

    assert.deepEqual(event, {
      invocationId: 'inv_123',
      type: 'progress',
      message: 'Imported first batch',
      data: { imported: 25 },
      timestamp: '2026-05-26T05:00:00.000Z',
    });
    assert.deepEqual(progress.emitted, [event]);
  });

  it('TC-PC-070 proves job cancellation stops future progress events', () => {
    const progress = createCancellableRuntimeProgressEmitter('inv_cancelled_001', () => new Date('2026-05-26T05:00:00.000Z'));
    const beforeCancel = progress.emit('started');

    progress.cancel();
    const afterCancel = progress.emit('should not be emitted');

    assert.equal(progress.isCancelled(), true);
    assert.equal(afterCancel, null);
    assert.deepEqual(progress.emitted, [beforeCancel]);
    assert.doesNotMatch(JSON.stringify(progress.emitted), /should not be emitted/);
  });

  it('TC-PC-027 scopes SSE progress stream events to the requested invocation', () => {
    const sse = serializeScopedProgressSse('inv_123', [
      { invocationId: 'inv_123', type: 'progress', message: 'first', timestamp: '2026-05-26T05:00:00.000Z' },
      { invocationId: 'inv_other', type: 'progress', message: 'leak', timestamp: '2026-05-26T05:00:01.000Z' },
      { invocationId: 'inv_123', type: 'progress', message: 'second', timestamp: '2026-05-26T05:00:02.000Z' },
    ]);

    assert.match(sse, /event: progress/);
    assert.match(sse, /first/);
    assert.match(sse, /second/);
    assert.doesNotMatch(sse, /leak/);
    assert.doesNotMatch(sse, /inv_other/);
  });

});
