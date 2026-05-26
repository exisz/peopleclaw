import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRuntimeProgressEmitter } from './runtimeProgressEvents';

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
});
