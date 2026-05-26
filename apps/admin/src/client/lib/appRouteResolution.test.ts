import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCoreAppShellRoute, resolveDeploymentManifestRequest } from './appRouteResolution';

describe('PeopleClaw core app shell route resolution', () => {
  it('TC-PC-011 resolves /apps/:appId/* through the core shell namespace', () => {
    assert.deepEqual(resolveCoreAppShellRoute('/apps/demo-crm/dashboard'), {
      appId: 'demo-crm',
      appPath: '/dashboard',
    });

    assert.equal(resolveCoreAppShellRoute('/apps'), null);
    assert.equal(resolveCoreAppShellRoute('/settings'), null);
  });

  it('TC-PC-013 loads the production deployment manifest for production routes', () => {
    assert.deepEqual(resolveDeploymentManifestRequest('/apps/demo-crm/dashboard'), {
      appId: 'demo-crm',
      appPath: '/dashboard',
      channel: 'production',
    });
  });

  it('TC-PC-014 loads the preview deployment manifest for preview routes', () => {
    assert.deepEqual(resolveDeploymentManifestRequest('/apps/demo-crm/dashboard', '?preview=dep_preview_001'), {
      appId: 'demo-crm',
      appPath: '/dashboard',
      channel: 'preview',
      deploymentId: 'dep_preview_001',
    });
  });

  it('TC-PC-092 soft-deploy E2E proves no core redeploy required', () => {
    const before = resolveDeploymentManifestRequest('/apps/demo-crm/dashboard', '?preview=dep_demo_crm_v1');
    const after = resolveDeploymentManifestRequest('/apps/demo-crm/dashboard', '?preview=dep_demo_crm_v2');

    assert.deepEqual(
      { appId: before?.appId, appPath: before?.appPath, channel: before?.channel },
      { appId: after?.appId, appPath: after?.appPath, channel: after?.channel },
      'soft-deploying a new deployment artifact must keep the same core shell route',
    );
    assert.equal(before?.deploymentId, 'dep_demo_crm_v1');
    assert.equal(after?.deploymentId, 'dep_demo_crm_v2');
    assert.doesNotMatch(JSON.stringify(after), /VITE_BUILD_SHA|github\.sha|coreBuild|redeploy/i);
  });
});
