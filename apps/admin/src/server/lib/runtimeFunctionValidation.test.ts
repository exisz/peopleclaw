import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { invokeRuntimeFunctionWithInputValidation } from './runtimeFunctionValidation';

describe('PeopleClaw runtime function validation', () => {
  it('TC-PC-024 validates function input before calling the handler', async () => {
    let handlerCalls = 0;
    const rejected = await invokeRuntimeFunctionWithInputValidation({
      payload: { name: 42 },
      inputSchema: {
        type: 'object',
        required: ['name', 'email'],
        properties: { name: 'string', email: 'string' },
      },
      handler: () => {
        handlerCalls += 1;
        return { created: true };
      },
    });

    assert.equal(rejected.ok, false);
    assert.equal(rejected.stage, 'input');
    assert.deepEqual(rejected.errors, ['email is required', 'name must be string']);
    assert.equal(handlerCalls, 0);

    const accepted = await invokeRuntimeFunctionWithInputValidation({
      payload: { name: 'Ada', email: 'ada@example.com' },
      inputSchema: {
        type: 'object',
        required: ['name', 'email'],
        properties: { name: 'string', email: 'string' },
      },
      handler: () => {
        handlerCalls += 1;
        return { created: true };
      },
    });

    assert.deepEqual(accepted, { ok: true, result: { created: true } });
    assert.equal(handlerCalls, 1);
  });

  it('TC-PC-025 validates function output after the handler returns', async () => {
    const rejected = await invokeRuntimeFunctionWithInputValidation({
      payload: { id: 'lead_123' },
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: { id: 'string' },
      },
      outputSchema: {
        type: 'object',
        required: ['created', 'leadId'],
        properties: { created: 'boolean', leadId: 'string' },
      },
      handler: () => ({ created: 'yes' }),
    });

    assert.equal(rejected.ok, false);
    assert.equal(rejected.stage, 'output');
    assert.deepEqual(rejected.errors, ['leadId is required', 'created must be boolean']);
  });

});
