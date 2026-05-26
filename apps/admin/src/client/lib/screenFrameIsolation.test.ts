import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { acceptScreenBridgeMessage, createScreenIframeUrl } from './screenFrameIsolation';

describe('PeopleClaw screen iframe origin isolation', () => {
  it('TC-PC-019 runs a screen iframe on a separate origin from the core shell', () => {
    const frame = createScreenIframeUrl({
      coreOrigin: 'https://app.peopleclaw.example',
      screenOrigin: 'https://screens.peopleclaw-runtime.example',
      appId: 'demo-crm',
      deploymentId: 'dep_preview_123',
      screenId: 'screens/Dashboard.tsx',
    });

    assert.equal(frame.origin, 'https://screens.peopleclaw-runtime.example');
    assert.notEqual(frame.origin, 'https://app.peopleclaw.example');
    assert.equal(new URL(frame.src).origin, frame.origin);
    assert.equal(new URL(frame.src).searchParams.get('deploymentId'), 'dep_preview_123');
    assert.match(frame.sandbox, /allow-scripts/);
  });

  it('rejects same-origin screen frames', () => {
    assert.throws(() => createScreenIframeUrl({
      coreOrigin: 'https://app.peopleclaw.example',
      screenOrigin: 'https://app.peopleclaw.example',
      appId: 'demo-crm',
      deploymentId: 'dep_prod_123',
      screenId: 'screens/Dashboard.tsx',
    }), /must be separate/);
  });

  it('TC-PC-057 proves postMessage rejects wrong origin', () => {
    const accepted = acceptScreenBridgeMessage({
      expectedOrigin: 'https://screens.peopleclaw-runtime.example',
      eventOrigin: 'https://screens.peopleclaw-runtime.example',
      data: { type: 'peopleclaw.screen.ready', payload: { screenId: 'screens/Dashboard.tsx' } },
    });
    const rejected = acceptScreenBridgeMessage({
      expectedOrigin: 'https://screens.peopleclaw-runtime.example',
      eventOrigin: 'https://evil.example',
      data: { type: 'peopleclaw.screen.ready', payload: { screenId: 'screens/Dashboard.tsx' } },
    });

    assert.equal(accepted.ok, true);
    assert.deepEqual(rejected, { ok: false, reason: 'wrong_origin' });
  });
});
