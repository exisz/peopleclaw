import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveScreenBundleByHash } from './screenBundleManifest';

describe('PeopleClaw immutable screen bundle loading', () => {
  it('TC-PC-016 loads screen bundles by immutable content hash', () => {
    const request = resolveScreenBundleByHash('screens/Dashboard.tsx', 'sha256:dashboard-v2', {
      'sha256:dashboard-v1': {
        screen: 'screens/Dashboard.tsx',
        artifactHash: 'sha256:dashboard-v1',
        bundleUrl: 'https://artifacts.example/sha256-dashboard-v1.mjs',
      },
      'sha256:dashboard-v2': {
        screen: 'screens/Dashboard.tsx',
        artifactHash: 'sha256:dashboard-v2',
        bundleUrl: 'https://artifacts.example/sha256-dashboard-v2.mjs',
      },
    });

    assert.deepEqual(request, {
      screen: 'screens/Dashboard.tsx',
      artifactHash: 'sha256:dashboard-v2',
      bundleUrl: 'https://artifacts.example/sha256-dashboard-v2.mjs',
    });
  });
});
