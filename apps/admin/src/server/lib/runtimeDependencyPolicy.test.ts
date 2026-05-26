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

  it('TC-PC-065 proves native binary dependency blocks MVP build', () => {
    const rejectedDefaultNative = validateRuntimeDependencyAllowlist({
      requestedDependencies: { sharp: '0.33.5' },
      allowlist: { sharp: '0.33.5' },
    });
    assert.equal(rejectedDefaultNative.ok, false);
    assert.match(rejectedDefaultNative.errors.join('\n'), /native binary dependency is not allowed.*sharp/);

    const rejectedConfiguredNative = validateRuntimeDependencyAllowlist({
      requestedDependencies: { 'custom-native-addon': '1.0.0' },
      allowlist: { 'custom-native-addon': '1.0.0' },
      nativeDenylist: ['custom-native-addon'],
    });
    assert.equal(rejectedConfiguredNative.ok, false);
    assert.match(rejectedConfiguredNative.errors.join('\n'), /native binary dependency is not allowed.*custom-native-addon/);
  });

});
