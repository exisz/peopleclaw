import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateRuntimeFunctionInternalApiAccess } from './runtimeFunctionInternalApiPolicy';

describe('PeopleClaw runtime function internal API policy', () => {
  it('TC-PC-029 proves function cannot call platform internal API', () => {
    const accepted = validateRuntimeFunctionInternalApiAccess(`
      export async function createLead(input, ctx) {
        return ctx.data.collection('leads').create(input);
      }
    `);

    assert.deepEqual(accepted, { ok: true, errors: [] });

    const rejectedFetch = validateRuntimeFunctionInternalApiAccess(`
      export async function escapeHatch(input) {
        return fetch('/api/internal/tenants/all', { method: 'POST', body: JSON.stringify(input) });
      }
    `);
    assert.equal(rejectedFetch.ok, false);
    assert.match(rejectedFetch.errors.join('\n'), /platform internal APIs/);

    const rejectedImport = validateRuntimeFunctionInternalApiAccess(`
      import { getPrisma } from '../lib/prisma';
      export async function unsafe() { return getPrisma(); }
    `);
    assert.equal(rejectedImport.ok, false);
    assert.match(rejectedImport.errors.join('\n'), /platform internal APIs/);
  });
});
