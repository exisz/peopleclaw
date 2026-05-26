import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAppArtifactTree } from './app-artifact';

describe('PeopleClaw app artifact schema', () => {
  const minimalAppTree = {
    manifest: {
      appId: 'demo-crm',
      name: 'Demo CRM',
      version: '1.0.0',
      routes: [
        { id: 'dashboard', path: '/apps/demo-crm/dashboard', screen: 'screens/Dashboard.tsx' },
      ],
    },
    sidebar: {
      sections: [
        {
          id: 'app',
          title: 'App',
          kind: 'app',
          items: [{ id: 'dashboard', label: 'Dashboard', routeId: 'dashboard' }],
        },
      ],
    },
    screens: {
      'screens/Dashboard.tsx': 'export default function Dashboard() { return <main>Dashboard</main>; }',
    },
    functions: {},
    data: { collections: [], indexes: [], playbooks: {} },
    secrets: {},
    tests: {},
  };

  it('TC-PC-001 accepts a minimal valid app tree', () => {
    const result = validateAppArtifactTree(minimalAppTree);

    assert.deepEqual(result, { ok: true, errors: [] });
  });

  it('TC-PC-002 rejects an app tree missing manifest', () => {
    const { manifest: _manifest, ...treeWithoutManifest } = minimalAppTree;

    const result = validateAppArtifactTree(treeWithoutManifest);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /manifest must be an object/);
  });

  it('TC-PC-003 rejects duplicate manifest route ids', () => {
    const appTreeWithDuplicateRouteIds = {
      ...minimalAppTree,
      manifest: {
        ...minimalAppTree.manifest,
        routes: [
          ...minimalAppTree.manifest.routes,
          { id: 'dashboard', path: '/apps/demo-crm/duplicate-dashboard', screen: 'screens/DashboardCopy.tsx' },
        ],
      },
    };

    const result = validateAppArtifactTree(appTreeWithDuplicateRouteIds);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /manifest\.routes\[1\]\.id must be unique/);
  });

  it('TC-PC-004 rejects manifest routes outside the app namespace', () => {
    const appTreeWithForeignRoute = {
      ...minimalAppTree,
      manifest: {
        ...minimalAppTree.manifest,
        routes: [
          { id: 'dashboard', path: '/apps/other-app/dashboard', screen: 'screens/Dashboard.tsx' },
        ],
      },
    };

    const result = validateAppArtifactTree(appTreeWithForeignRoute);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /manifest\.routes\[0\]\.path must be inside \/apps\/demo-crm/);
  });

  it('TC-PC-005 accepts app and system sidebar sections', () => {
    const appTreeWithAppAndSystemSections = {
      ...minimalAppTree,
      sidebar: {
        sections: [
          minimalAppTree.sidebar.sections[0],
          {
            id: 'system',
            title: 'System',
            kind: 'system',
            items: [{ id: 'settings', label: 'Settings', routeId: 'dashboard' }],
          },
        ],
      },
    };

    const result = validateAppArtifactTree(appTreeWithAppAndSystemSections);

    assert.deepEqual(result, { ok: true, errors: [] });
  });

  it('TC-PC-006 rejects duplicate sidebar ids', () => {
    const appTreeWithDuplicateSidebarIds = {
      ...minimalAppTree,
      sidebar: {
        sections: [
          minimalAppTree.sidebar.sections[0],
          {
            id: 'app',
            title: 'Duplicate App Section',
            kind: 'system',
            items: [{ id: 'dashboard', label: 'Dashboard Copy', routeId: 'dashboard' }],
          },
        ],
      },
    };

    const result = validateAppArtifactTree(appTreeWithDuplicateSidebarIds);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /sidebar\.sections\[1\]\.id must be unique/);
    assert.match(result.errors.join('\n'), /sidebar\.sections\[1\]\.items\[0\]\.id must be unique/);
  });
});
