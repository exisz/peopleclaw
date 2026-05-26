import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateRuntimeDependencyAllowlist } from './runtimeDependencyPolicy';

describe('PeopleClaw runtime dependency policy', () => {
  it('TC-PC-064 proves unallowlisted npm dependency blocks build', () => {
    const allowlist = {
      zod: '4.3.6',
      nanoid: ['5.1.9'],
    };

    const accepted = validateRuntimeDependencyAllowlist({
      requestedDependencies: { zod: '4.3.6', nanoid: '5.1.9' },
      allowlist,
    });
    assert.deepEqual(accepted, { ok: true, errors: [] });

    const rejectedPackage = validateRuntimeDependencyAllowlist({
      requestedDependencies: { lodash: '4.17.21' },
      allowlist,
    });
    assert.equal(rejectedPackage.ok, false);
    assert.match(rejectedPackage.errors.join('\n'), /dependency is not allowlisted: lodash/);

    const rejectedVersion = validateRuntimeDependencyAllowlist({
      requestedDependencies: { zod: '3.22.4' },
      allowlist,
    });
    assert.equal(rejectedVersion.ok, false);
    assert.match(rejectedVersion.errors.join('\n'), /dependency version is not allowlisted: zod@3\.22\.4/);
  });
});
