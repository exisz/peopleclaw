import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAppArtifactTree } from './app-artifact';

describe('PeopleClaw app artifact schema', () => {
  it('TC-PC-001 accepts a minimal valid app tree', () => {
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

    const result = validateAppArtifactTree(minimalAppTree);

    assert.deepEqual(result, { ok: true, errors: [] });
  });
});
