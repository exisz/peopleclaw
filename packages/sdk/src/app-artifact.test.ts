import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInMemoryAppArtifactStore, createInMemoryAppDeploymentRegistry, planImmutableAppArtifactStorage, validateAppArtifactTree, validateAppDeploymentRecord } from './app-artifact';

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
      'screens/Dashboard.tsx': {
        source: 'export default function Dashboard() { return <main>Dashboard</main>; }',
        artifactHash: 'sha256:dashboard-screen',
      },
    },
    functions: {
      'functions/createContact.ts': {
        source: 'export default async function createContact() { return { ok: true }; }',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
      },
    },
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

  it('TC-PC-007 rejects screen metadata missing artifact hash', () => {
    const appTreeWithMissingScreenHash = {
      ...minimalAppTree,
      screens: {
        'screens/Dashboard.tsx': {
          source: 'export default function Dashboard() { return <main>Dashboard</main>; }',
        },
      },
    };

    const result = validateAppArtifactTree(appTreeWithMissingScreenHash);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /screens\.screens\/Dashboard\.tsx\.artifactHash must be a non-empty string/);
  });

  it('TC-PC-008 rejects function contracts missing input schema', () => {
    const appTreeWithMissingInputSchema = {
      ...minimalAppTree,
      functions: {
        'functions/createContact.ts': {
          source: 'export default async function createContact() { return { ok: true }; }',
          outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        },
      },
    };

    const result = validateAppArtifactTree(appTreeWithMissingInputSchema);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /functions\.functions\/createContact\.ts\.inputSchema is required/);
  });

  it('TC-PC-009 rejects function contracts missing output schema', () => {
    const appTreeWithMissingOutputSchema = {
      ...minimalAppTree,
      functions: {
        'functions/createContact.ts': {
          source: 'export default async function createContact() { return { ok: true }; }',
          inputSchema: { type: 'object', properties: {} },
        },
      },
    };

    const result = validateAppArtifactTree(appTreeWithMissingOutputSchema);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /functions\.functions\/createContact\.ts\.outputSchema is required/);
  });

  it('TC-PC-010 requires deployment records to declare SDK and runtime compatibility versions', () => {
    const deploymentRecordMissingCompatibilityVersions = {
      id: 'record_demo-crm_prod_001',
      appId: 'demo-crm',
      deploymentId: 'dep_demo-crm_prod_001',
      channel: 'production',
      artifactHash: 'sha256:app-artifact-tree',
      createdAt: '2026-05-26T00:00:00.000Z',
    };

    const result = validateAppDeploymentRecord(deploymentRecordMissingCompatibilityVersions);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /deploymentRecord\.sdkCompatibilityVersion must be a non-empty string/);
    assert.match(result.errors.join('\n'), /deploymentRecord\.runtimeCompatibilityVersion must be a non-empty string/);
  });

  it('TC-PC-041 proves plan stores immutable artifact by content hash', async () => {
    const plan = await planImmutableAppArtifactStorage(minimalAppTree);

    assert.equal(plan.operation, 'store_immutable_artifact');
    assert.match(plan.artifactHash, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(plan.artifact, minimalAppTree);
  });

  it('TC-PC-042 proves same artifact hash is deduplicated', async () => {
    const store = createInMemoryAppArtifactStore();
    const first = await store.put(minimalAppTree);
    const second = await store.put({ ...minimalAppTree, manifest: { ...minimalAppTree.manifest } });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.artifactHash, first.artifactHash);
    assert.equal(second.storedCount, 1);
  });

  it('TC-PC-043 proves preview deploy creates deployment record', async () => {
    const deployments = createInMemoryAppDeploymentRegistry();

    const result = await deployments.deployPreview(minimalAppTree, {
      appId: 'demo-crm',
      sdkCompatibilityVersion: '0.1.0',
      runtimeCompatibilityVersion: 'runtime-2026-05',
      now: new Date('2026-05-26T00:00:00.000Z'),
    });

    assert.equal(result.deploymentRecordCount, 1);
    assert.equal(result.deploymentRecord.appId, 'demo-crm');
    assert.equal(result.deploymentRecord.channel, 'preview');
    assert.equal(result.deploymentRecord.artifactHash, result.artifactHash);
    assert.equal(result.deploymentRecord.createdAt, '2026-05-26T00:00:00.000Z');
    assert.deepEqual(deployments.listDeploymentRecords(), [result.deploymentRecord]);
    assert.deepEqual(validateAppDeploymentRecord(result.deploymentRecord), { ok: true, errors: [] });
  });

  it('TC-PC-044 proves production pointer is unchanged after preview', async () => {
    const deployments = createInMemoryAppDeploymentRegistry({ productionDeploymentId: 'dep_demo-crm_prod_001' });

    await deployments.deployPreview(minimalAppTree, {
      appId: 'demo-crm',
      sdkCompatibilityVersion: '0.1.0',
      runtimeCompatibilityVersion: 'runtime-2026-05',
      now: new Date('2026-05-26T00:00:00.000Z'),
    });

    assert.equal(deployments.getProductionDeploymentId(), 'dep_demo-crm_prod_001');
    assert.equal(deployments.listDeploymentRecords()[0]?.channel, 'preview');
  });

  it('TC-PC-045 proves promote changes production pointer only', async () => {
    const deployments = createInMemoryAppDeploymentRegistry({ productionDeploymentId: 'dep_demo-crm_prod_001' });
    const preview = await deployments.deployPreview(minimalAppTree, {
      appId: 'demo-crm',
      sdkCompatibilityVersion: '0.1.0',
      runtimeCompatibilityVersion: 'runtime-2026-05',
      now: new Date('2026-05-26T00:00:00.000Z'),
    });
    const recordsBeforePromote = deployments.listDeploymentRecords();

    const promotion = deployments.promote(preview.deploymentRecord.deploymentId);

    assert.deepEqual(promotion, {
      previousProductionDeploymentId: 'dep_demo-crm_prod_001',
      productionDeploymentId: preview.deploymentRecord.deploymentId,
    });
    assert.equal(deployments.getProductionDeploymentId(), preview.deploymentRecord.deploymentId);
    assert.deepEqual(deployments.listDeploymentRecords(), recordsBeforePromote);
  });

  it('TC-PC-046 proves rollback restores previous production deployment pointer', async () => {
    const deployments = createInMemoryAppDeploymentRegistry({ productionDeploymentId: 'dep_demo-crm_prod_001' });
    const preview = await deployments.deployPreview(minimalAppTree, {
      appId: 'demo-crm',
      sdkCompatibilityVersion: '0.1.0',
      runtimeCompatibilityVersion: 'runtime-2026-05',
      now: new Date('2026-05-26T00:00:00.000Z'),
    });
    deployments.promote(preview.deploymentRecord.deploymentId);

    const rollback = deployments.rollbackProductionPointer();

    assert.deepEqual(rollback, {
      operation: 'restore_production_pointer',
      dataPlaneRollback: 'not_performed',
      rolledBackFromDeploymentId: preview.deploymentRecord.deploymentId,
      productionDeploymentId: 'dep_demo-crm_prod_001',
    });
    assert.equal(deployments.getProductionDeploymentId(), 'dep_demo-crm_prod_001');
  });

  it('TC-PC-047 proves rollback does not claim data rollback', async () => {
    const deployments = createInMemoryAppDeploymentRegistry({ productionDeploymentId: 'dep_demo-crm_prod_001' });
    const preview = await deployments.deployPreview(minimalAppTree, {
      appId: 'demo-crm',
      sdkCompatibilityVersion: '0.1.0',
      runtimeCompatibilityVersion: 'runtime-2026-05',
      now: new Date('2026-05-26T00:00:00.000Z'),
    });
    deployments.promote(preview.deploymentRecord.deploymentId);

    const rollback = deployments.rollbackProductionPointer();

    assert.equal(rollback.operation, 'restore_production_pointer');
    assert.equal(rollback.dataPlaneRollback, 'not_performed');
    assert.equal(Object.prototype.hasOwnProperty.call(rollback, 'dataRollbackPerformed'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(rollback, 'dataRollbackPlan'), false);
  });
});
