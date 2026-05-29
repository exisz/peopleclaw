import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createInMemoryAppDeploymentRegistry } from '@peopleclaw/sdk/app-artifact';
import { planStarterAppPreviewDeployment, starterAppTemplate, STARTER_APP_CONNECTOR_NAME, STARTER_APP_FULLSTACK_NAME, validateStarterAppConnectorSurface, verifyStarterPreviewDeployment, buildShopifyStarterSpecCompletenessMatrix, buildStarterAppArtifactTree, STARTER_APP_SIDEBAR_JSON5, buildStarterSecretReferenceEvidence, planStarterManagedDataSync, runOneClickShopifyStarterCrudDryRun } from './starter-app';

describe('Starter app template safety', () => {
  it('TC-PC-089 proves starter-app template has no SaaS-specific core code', () => {
    const forbiddenCoreCouplings = [
      /from ['"]\.\.\/\.\.\/routes\//,
      /from ['"]\.\.\/\.\.\/lib\/prisma/,
      /from ['"]@prisma\/client/,
      /getPrisma\(/,
      /app\.peopleclaw\.rollersoft\.com\.au/,
      /admin\.peopleclaw\.rollersoft\.com\.au/,
      /tenantId\s*===\s*['"][^'"]+['"]/,
      /appId\s*===\s*['"][^'"]+['"]/,
    ];

    for (const component of starterAppTemplate.components) {
      for (const forbidden of forbiddenCoreCouplings) {
        assert.doesNotMatch(
          component.code,
          forbidden,
          `${component.name} should stay a portable app artifact, not core SaaS-specific code`,
        );
      }
    }
  });

  it('TC-PC-2201 keeps the starter as code functions, not a graph/workflow', () => {
    const connectorIndex = starterAppTemplate.components.findIndex(c => c.name === STARTER_APP_CONNECTOR_NAME);
    const fullstackIndex = starterAppTemplate.components.findIndex(c => c.name === STARTER_APP_FULLSTACK_NAME);
    assert.notEqual(connectorIndex, -1, 'starter app includes store data source');
    assert.notEqual(fullstackIndex, -1, 'starter app includes product browser');

    const connector = starterAppTemplate.components[connectorIndex]!;
    const fullstack = starterAppTemplate.components[fullstackIndex]!;
    assert.equal(connector.type, 'BACKEND');
    assert.equal(connector.isExported, true);
    assert.equal(fullstack.type, 'FULLSTACK');
    assert.match(fullstack.code, /__CONNECTOR_ID__/);

    assert.equal('connections' in starterAppTemplate, false);
    assert.doesNotMatch(JSON.stringify(starterAppTemplate), /canvas|workflow|graph|probe|DATA_FLOW|TRIGGER/i);

  });

  it('TC-PC-106 proves Shopify setup is absent from core Settings and present in starter connector', () => {
    const settingsSource = readFileSync(new URL('../../../client/pages/Settings.tsx', import.meta.url), 'utf8');
    const settingsEn = readFileSync(new URL('../../../client/i18n/locales/en/settings.json', import.meta.url), 'utf8');
    const settingsZh = readFileSync(new URL('../../../client/i18n/locales/zh/settings.json', import.meta.url), 'utf8');

    for (const source of [settingsSource, settingsEn, settingsZh]) {
      assert.doesNotMatch(source, /shopify/i);
      assert.doesNotMatch(source, /connector/i);
      assert.doesNotMatch(source, /connection setup/i);
    }

    assert.doesNotMatch(settingsSource, /SettingsConnections/);
    assert.doesNotMatch(settingsSource, /settings-tab-connections/);
    assert.match(settingsSource, /Team and Billing settings/);

    const connector = starterAppTemplate.components.find(c => c.name === STARTER_APP_CONNECTOR_NAME)!;
    assert.equal(connector.type, 'BACKEND');
    assert.equal(connector.isExported, true);
    assert.match(connector.code, /SHOPIFY_SHOP_DOMAIN/);
    assert.match(connector.code, /SHOPIFY_ADMIN_TOKEN|SHOPIFY_CLIENT_ID/);

    const productBrowser = starterAppTemplate.components.find(c => c.name === STARTER_APP_FULLSTACK_NAME)!;
    assert.match(productBrowser.code, /shopify-setup-cta/);
    assert.match(productBrowser.code, /Connect store/);
  });

  it('TC-PC-107 proves Shopify starter flow exposes no delete-app operation', () => {
    const appsListSource = readFileSync(new URL('../../../client/pages/AppsList.tsx', import.meta.url), 'utf8');
    const appsRouteSource = readFileSync(new URL('../../routes/apps.ts', import.meta.url), 'utf8');
    const artifactText = JSON.stringify(starterAppTemplate);

    for (const source of [appsListSource, appsRouteSource, artifactText]) {
      assert.doesNotMatch(source, /delete[- ]?app/i);
      assert.doesNotMatch(source, /destroy[- ]?app/i);
      assert.doesNotMatch(source, /remove[- ]?app/i);
      assert.doesNotMatch(source, /archive[- ]?app/i);
    }

    assert.doesNotMatch(appsRouteSource, /appsRouter\.delete\(/);
    assert.doesNotMatch(appsRouteSource, /\.delete\s*\(/);
    assert.doesNotMatch(appsListSource, /method:\s*['"]DELETE['"]/i);
    assert.doesNotMatch(appsListSource, /apiClient\.delete/i);
    assert.match(appsListSource, /createFromTemplate/);
    assert.match(artifactText, /Shopify|SHOPIFY/);
  });

  it('TC-PC-135 keeps starter public wording business-facing, not runtime component jargon', () => {
    const publicCopy = [
      starterAppTemplate.name,
      starterAppTemplate.description,
      ...starterAppTemplate.components.flatMap((component) => [component.name, component.icon]),
      ...buildStarterAppArtifactTree('starter-shopify-demo').sidebar.sections.flatMap((section) => [
        section.title,
        ...section.items.map((item) => item.label),
      ]),
    ].filter(Boolean);

    assert.ok(publicCopy.some((copy) => /store|catalog|product|sync|chat|dashboard/i.test(copy)), 'starter exposes business wording');
    for (const copy of publicCopy) {
      assert.doesNotMatch(copy, /(?:FULLSTACK|FRONTEND|BACKEND)/, `${copy} must not expose runtime component type jargon`);
    }
  });

  it('TC-PC-108 proves Shopify token failures are recoverable and redacted', () => {
    const connector = starterAppTemplate.components.find(c => c.name === STARTER_APP_CONNECTOR_NAME)!;
    const productBrowser = starterAppTemplate.components.find(c => c.name === STARTER_APP_FULLSTACK_NAME)!;
    const artifactText = JSON.stringify(starterAppTemplate);

    assert.match(connector.code, /safeConnectorMessage/);
    assert.match(connector.code, /SHOPIFY_REFRESH_FAILED', recoverable: true/);
    assert.match(connector.code, /SHOPIFY_HTTP_' \+ r\.status, recoverable: true/);
    assert.match(connector.code, /NEED_SETUP/);
    assert.match(productBrowser.code, /data-state=\{isSetup \? 'need-setup' : 'error'\}/);

    for (const forbidden of [/shpat_[A-Za-z0-9_-]+/, /shpca_[A-Za-z0-9_-]+/, /access_token['"\s:=]+(shpat_|shpca_)[^'"\s,}]+/i]) {
      assert.doesNotMatch(artifactText, forbidden, `starter artifact must not expose ${forbidden}`);
    }
    assert.doesNotMatch(connector.code, /return \{ ok: false, error: 'SHOPIFY_REFRESH_FAILED', message: e\?\.message/);
    assert.doesNotMatch(connector.code, /body\.slice\(0, 300\)/);
  });


  it('TC-PC-110 validates Shopify connector component type before deploy', () => {
    const accepted = validateStarterAppConnectorSurface(starterAppTemplate);
    assert.equal(accepted.ok, true, accepted.errors.join('; '));
    assert.equal(accepted.connectorName, STARTER_APP_CONNECTOR_NAME);
    assert.equal(accepted.callerName, STARTER_APP_FULLSTACK_NAME);

    assert.doesNotThrow(() => planStarterAppPreviewDeployment({ appId: 'starter-shopify-demo' }));

    const unsupportedTypeTemplate = {
      ...starterAppTemplate,
      components: starterAppTemplate.components.map((component) =>
        component.name === STARTER_APP_CONNECTOR_NAME
          ? { ...component, type: 'FRONTEND' as const }
          : component,
      ),
    };
    const unsupportedType = validateStarterAppConnectorSurface(unsupportedTypeTemplate);
    assert.equal(unsupportedType.ok, false);
    assert.match(unsupportedType.errors.join(' | '), /connector must be BACKEND/);
    assert.throws(
      () => planStarterAppPreviewDeployment({ appId: 'starter-shopify-demo', template: unsupportedTypeTemplate }),
      /starter_connector_surface_invalid: .*connector must be BACKEND/,
    );

    const unsupportedSignatureTemplate = {
      ...starterAppTemplate,
      components: starterAppTemplate.components.map((component) =>
        component.name === STARTER_APP_CONNECTOR_NAME
          ? { ...component, code: 'export default async function run(ctx: any) { return { ok: true }; }' }
          : component,
      ),
    };
    const unsupportedSignature = validateStarterAppConnectorSurface(unsupportedSignatureTemplate);
    assert.equal(unsupportedSignature.ok, false);
    assert.match(unsupportedSignature.errors.join(' | '), /default async run\(input, ctx\)/);
    assert.throws(
      () => planStarterAppPreviewDeployment({ appId: 'starter-shopify-demo', template: unsupportedSignatureTemplate }),
      /starter_connector_surface_invalid: .*default async run\(input, ctx\)/,
    );
  });









  it('TC-PC-125 runs one-click Shopify starter form through backend CRUD dry-run with audit evidence', () => {
    const artifact = buildStarterAppArtifactTree('starter-shopify-demo');
    assert.match(artifact.screens!.sync.source, /data-testid="shopify-crud-dry-run-form"/);
    assert.match(artifact.screens!.sync.source, /Run Shopify CRUD dry-run/);
    assert.match(artifact.screens!.sync.source, /Image prompt/);
    assert.match(artifact.screens!.sync.source, /shopify-crud-audit-evidence/);

    const result = runOneClickShopifyStarterCrudDryRun({
      appId: 'starter-shopify-demo',
      baseUrl: 'https://preview.peopleclaw.test',
      now: new Date('2026-05-28T08:15:00.000Z'),
      form: {
        shopDomainRef: 'app-secret://SHOPIFY_SHOP_DOMAIN',
        action: 'createProduct',
        productTitle: 'Dry-run product from form',
        dryRun: true,
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.formSubmission.submitted, true);
    assert.equal(result.formSubmission.testId, 'shopify-crud-dry-run-form');
    assert.equal(result.backendInvocation.invoked, true);
    assert.equal(result.backendInvocation.functionId, 'functions/shopifyConnector');
    assert.equal(result.backendInvocation.method, 'createProduct');
    assert.equal(result.backendInvocation.via, 'ctx.callApp');
    assert.deepEqual(result.crudDryRun, {
      ok: true,
      mode: 'dry_run',
      mockedSafeWrite: true,
      writes: 0,
      dataApiCollections: ['shopify_products', 'shopify_orders', 'shopify_customers'],
    });
    assert.equal(result.auditEvidence.visibleToUser, true);
    assert.match(result.previewUrl, /\/apps\/starter-shopify-demo\?preview=/);
    assert.deepEqual(result.auditEvidence.events.filter((event) => /form|backend|dry_run|audit/.test(event)), [
      'shopify_crud_form_submitted',
      'backend_createProduct_invoked_via_ctx_callApp',
      'shopify_crud_dry_run_recorded',
      'audit_evidence_visible_to_user',
    ]);

    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /shpat_|shpca_|plain[_-]?text|SHOPIFY_ADMIN_TOKEN\s*[:=]\s*['"][^'"]+['"]/i);
  });


  it('TC-PC-126 calls AI image processing from prompt before Shopify CRUD payload construction', () => {
    const result = runOneClickShopifyStarterCrudDryRun({
      appId: 'starter-shopify-demo',
      baseUrl: 'https://preview.peopleclaw.test',
      now: new Date('2026-05-28T08:35:00.000Z'),
      form: {
        shopDomainRef: 'app-secret://SHOPIFY_SHOP_DOMAIN',
        action: 'createProduct',
        productTitle: 'Prompted product',
        imagePrompt: 'clean product photo on a neutral studio background',
        dryRun: true,
      },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.imageProcessing, {
      invokedBeforeCrud: true,
      step: 'ai_image_processing',
      promptProvided: true,
      outputRef: result.imageProcessing.outputRef,
      safeFailure: null,
    });
    assert.match(result.imageProcessing.outputRef ?? '', /^app-artifact:\/\/generated-images\/[a-f0-9]+\.png$/);
    assert.equal(result.backendInvocation.method, 'createProduct');
    assert.equal(result.crudDryRun.writes, 0);
    assert.equal(
      result.auditEvidence.events.indexOf('ai_image_processing_invoked_before_shopify_crud') <
        result.auditEvidence.events.indexOf('backend_createProduct_invoked_via_ctx_callApp'),
      true,
      'image processing must be audited before Shopify CRUD invocation',
    );

    const noPrompt = runOneClickShopifyStarterCrudDryRun({
      appId: 'starter-shopify-demo',
      form: { action: 'updateProduct', productTitle: 'No image prompt', dryRun: true },
    });
    assert.equal(noPrompt.imageProcessing.invokedBeforeCrud, false);
    assert.deepEqual(noPrompt.imageProcessing.safeFailure, {
      ok: true,
      recoverable: true,
      message: 'No image prompt provided; CRUD dry-run continues without generated image.',
    });
    assert.match(noPrompt.auditEvidence.events.join(' '), /ai_image_processing_skipped_no_prompt/);
  });

  it('TC-PC-119 promotes verified starter preview by pointer and rolls back pointer only', async () => {
    const registry = createInMemoryAppDeploymentRegistry({
      currentSdkCompatibilityVersion: '0.1.0',
      currentRuntimeCompatibilityVersion: 'peopleclaw-cloud-v1',
    });
    const priorPreview = await registry.deployPreview(
      buildStarterAppArtifactTree('starter-shopify-demo'),
      {
        appId: 'starter-shopify-demo',
        sdkCompatibilityVersion: '0.1.0',
        runtimeCompatibilityVersion: 'peopleclaw-cloud-v1',
        dependencyVersions: { react: '19' },
        now: new Date('2026-05-28T04:25:00.000Z'),
      },
    );
    registry.promote(priorPreview.deploymentRecord.deploymentId);

    const verifiedDeployment = planStarterAppPreviewDeployment({
      appId: 'starter-shopify-demo',
      now: new Date('2026-05-28T04:30:00.000Z'),
    });
    const verification = verifyStarterPreviewDeployment(verifiedDeployment, { hasToken: true });
    assert.equal(verification.ok, true);
    const preview = await registry.deployPreview(
      verifiedDeployment.immutableArtifact.artifact,
      {
        appId: 'starter-shopify-demo',
        sdkCompatibilityVersion: verifiedDeployment.deploymentRecord.sdkCompatibilityVersion,
        runtimeCompatibilityVersion: verifiedDeployment.deploymentRecord.runtimeCompatibilityVersion,
        dependencyVersions: verifiedDeployment.deploymentRecord.dependencyVersions,
        now: new Date('2026-05-28T04:30:00.000Z'),
      },
    );

    const promoted = registry.promote(preview.deploymentRecord.deploymentId);
    assert.deepEqual(promoted, {
      previousProductionDeploymentId: priorPreview.deploymentRecord.deploymentId,
      productionDeploymentId: preview.deploymentRecord.deploymentId,
    });
    assert.equal(registry.getProductionDeploymentId(), preview.deploymentRecord.deploymentId);

    const rollback = registry.rollbackProductionPointer();
    assert.deepEqual(rollback, {
      operation: 'restore_production_pointer',
      dataPlaneRollback: 'not_performed',
      rolledBackFromDeploymentId: preview.deploymentRecord.deploymentId,
      productionDeploymentId: priorPreview.deploymentRecord.deploymentId,
    });
    assert.equal(registry.getProductionDeploymentId(), priorPreview.deploymentRecord.deploymentId);
    assert.doesNotMatch(JSON.stringify(rollback), /shopify rollback|data rollback|order rollback|product rollback/i);
  });

  it('TC-PC-118 writes Shopify sync data only through managed document Data API', () => {
    const plan = planStarterManagedDataSync({
      products: [{ id: 'p1' }],
      orders: [{ id: 'o1' }, { id: 'o2' }],
      customers: [{ id: 'c1' }],
    });
    assert.deepEqual(plan.collections, ['shopify_products', 'shopify_orders', 'shopify_customers']);
    assert.deepEqual(plan.operations.map((operation) => operation.api), [
      'ctx.data.documents.upsertMany',
      'ctx.data.documents.upsertMany',
      'ctx.data.documents.upsertMany',
    ]);
    assert.deepEqual(plan.operations.map((operation) => operation.count), [1, 2, 1]);
    assert.deepEqual(plan.forbidden, []);

    const serializedPlan = JSON.stringify(plan);
    for (const forbidden of [
      /DATABASE_URL/i,
      /TURSO_/i,
      /prisma\./i,
      /createClient\(/i,
      /db\.execute/i,
      /ALTER\s+TABLE/i,
      /CREATE\s+TABLE/i,
      /raw\s+DB/i,
      /migration/i,
    ]) {
      assert.doesNotMatch(serializedPlan, forbidden);
    }
  });

  it('TC-PC-117 keeps Shopify starter secrets as references across artifacts and evidence outputs', () => {
    const evidence = buildStarterSecretReferenceEvidence('starter-shopify-demo');
    assert.deepEqual(evidence.secretRefs.sort(), [
      'app-secret://SHOPIFY_ADMIN_TOKEN',
      'app-secret://SHOPIFY_SHOP_DOMAIN',
    ]);
    const combined = [
      evidence.artifact,
      evidence.clientManifest,
      evidence.logs,
      evidence.screenshots,
      evidence.cliOutput,
    ].join('\n');
    assert.match(combined, /app-secret:\/\/SHOPIFY_ADMIN_TOKEN/);
    assert.match(combined, /app-secret:\/\/SHOPIFY_SHOP_DOMAIN/);
    for (const plaintextPattern of [
      /shpat_[A-Za-z0-9_-]+/,
      /shpca_[A-Za-z0-9_-]+/,
      /SHOPIFY_ADMIN_TOKEN\s*[:=]\s*['"][^'"]+['"]/,
      /SHOPIFY_CLIENT_SECRET\s*[:=]\s*['"][^'"]+['"]/,
      /access[_-]?token\s*[:=]\s*['"](?!\[redacted\])[^'"]+['"]/i,
      /client[_-]?secret\s*[:=]\s*['"](?!\[redacted\])[^'"]+['"]/i,
    ]) {
      assert.doesNotMatch(combined, plaintextPattern);
    }
  });

  it('TC-PC-116 exposes business and system pages through starter sidebar artifact config', () => {
    const artifact = buildStarterAppArtifactTree('starter-shopify-demo');
    const sections = artifact.sidebar.sections;
    assert.deepEqual(sections.map((section) => section.id), ['business', 'system']);
    assert.deepEqual(sections[0].items.map((item) => item.label), ['Dashboard', STARTER_APP_FULLSTACK_NAME, 'Sync', 'Chat']);
    assert.deepEqual(sections[1].items.map((item) => item.label), ['Setup', 'Audit']);
    assert.equal(sections[0].kind, 'app');
    assert.equal(sections[1].kind, 'system');
    for (const item of sections.flatMap((section) => section.items)) {
      const route = artifact.manifest.routes.find((candidate) => candidate.id === item.routeId);
      assert.equal(Boolean(route), true, `${item.routeId} route must exist`);
      assert.equal(Boolean(artifact.screens?.[route!.screen]), true, `${route!.screen} screen must exist`);
    }
    assert.match(STARTER_APP_SIDEBAR_JSON5, /sidebar|sections|dashboard|products|sync|chat|system/i);
    assert.equal(JSON.stringify(artifact.sidebar).includes('/settings/shopify'), false);
    assert.equal(JSON.stringify(artifact.sidebar).includes('/workflows'), false);
  });

  it('TC-PC-115 represents Shopify starter as a normal App artifact tree', () => {
    const artifact = buildStarterAppArtifactTree('starter-shopify-demo');
    assert.deepEqual(Object.keys(artifact).sort(), [
      'data',
      'functions',
      'manifest',
      'screens',
      'secrets',
      'sidebar',
      'tests',
    ]);
    assert.equal(artifact.manifest.routes[0].path, '/apps/starter-shopify-demo');
    assert.equal(artifact.sidebar.sections[0].kind, 'app');
    assert.equal(Boolean(artifact.screens?.products?.source), true);
    assert.equal(Boolean(artifact.functions?.shopifyConnector?.source), true);
    assert.equal(Boolean(artifact.data?.collections?.length), true);
    assert.equal(Boolean(artifact.data?.indexes?.length), true);
    assert.equal(Boolean(artifact.data?.playbooks?.verifyConnection), true);
    assert.deepEqual(artifact.secrets?.SHOPIFY_ADMIN_TOKEN, { ref: 'app-secret://SHOPIFY_ADMIN_TOKEN' });
    assert.match(artifact.tests?.starterTemplateSafety ?? '', /starter-app\.test\.ts$/);
    assert.equal('connectorClient' in artifact, false);
    assert.equal('coreRoutes' in artifact, false);
    assert.equal('cronJobs' in artifact, false);
  });

  it('TC-PC-113 covers every Shopify starter sidecar must and must-not obligation', () => {
    const matrix = buildShopifyStarterSpecCompletenessMatrix();
    assert.equal(matrix.length >= 10, true, 'matrix should split sidecar obligations into reviewable rows');
    assert.deepEqual(matrix.filter((row) => !row.ok), []);
    assert.deepEqual(new Set(matrix.map((row) => row.source)), new Set(['must', 'must_not']));
    for (const required of [
      'starter-app-contract',
      'one-click-preview-deploy',
      'secret-references-only',
      'generic-platform-primitives',
      'connector-component-surface',
      'verification-path',
      'no-workflow-canvas-primary-ui',
      'no-core-settings-shopify',
      'no-destructive-delete',
      'no-placeholder-fake-success',
      'no-core-shopify-client',
    ]) {
      assert.equal(matrix.some((row) => row.id === required), true, `missing matrix row ${required}`);
    }
    for (const row of matrix) {
      assert.equal(row.evidence.length > 0, true, `${row.id} must cite evidence`);
    }
  });

  it('TC-PC-112 records Shopify starter post-deploy verification evidence', () => {
    const deployment = planStarterAppPreviewDeployment({
      appId: 'starter-shopify-demo',
      baseUrl: 'https://preview.peopleclaw.test',
      now: new Date('2026-05-28T04:20:00.000Z'),
    });

    const needsSetup = verifyStarterPreviewDeployment(deployment, { hasToken: false, hasConnection: false });
    assert.equal(needsSetup.ok, true);
    assert.deepEqual(needsSetup.routeRender, { ok: true, routeId: 'products', screen: 'products' });
    assert.deepEqual(needsSetup.tokenState.state, 'needs_setup');
    assert.match(needsSetup.tokenState.secretRefs.join(' '), /app-secret:\/\/SHOPIFY_SHOP_DOMAIN/);
    assert.equal(needsSetup.connectorCompatibility.ok, true);
    assert.deepEqual(needsSetup.syncDryRun, { ok: true, method: 'listProducts', mode: 'dry_run', writes: 0 });
    assert.deepEqual(needsSetup.auditEvidence.events, [
      'route_render_checked',
      'token_state_needs_setup',
      'connector_component_compatibility_checked',
      'dry_run_recorded',
      'starter_preview_verification_complete',
    ]);
    assert.equal(needsSetup.auditEvidence.artifactHash, deployment.immutableArtifact.artifactHash);
    assert.equal(needsSetup.auditEvidence.deploymentId, deployment.deploymentRecord.deploymentId);

    const ready = verifyStarterPreviewDeployment(deployment, { hasToken: true });
    assert.equal(ready.tokenState.state, 'ready');
    assert.equal(ready.syncDryRun.mode, 'sample_fetch');
    assert.match(ready.auditEvidence.events.join(' '), /sample_fetch_recorded/);
  });

  it('TC-PC-109 proves one-click Shopify starter deploy creates preview deployment record', () => {
    const result = planStarterAppPreviewDeployment({
      appId: 'starter-shopify-demo',
      baseUrl: 'https://preview.peopleclaw.test',
      now: new Date('2026-05-28T03:07:00.000Z'),
    });

    assert.deepEqual(result.plan, {
      operation: 'starter_one_click_preview_deploy',
      dryRun: true,
      coreRedeploy: 'not_required',
    });
    assert.equal(result.immutableArtifact.stored, true);
    assert.match(result.immutableArtifact.artifactHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(result.immutableArtifact.artifact.manifest.appId, 'starter-shopify-demo');
    assert.match(result.immutableArtifact.artifact.functions?.shopifyConnector?.source ?? '', /SHOPIFY_ADMIN_TOKEN/);
    assert.equal(result.deploymentRecord.channel, 'preview');
    assert.equal(result.deploymentRecord.artifactHash, result.immutableArtifact.artifactHash);
    assert.equal(result.deploymentRecord.createdAt, '2026-05-28T03:07:00.000Z');
    assert.equal(result.previewUrl, 'https://preview.peopleclaw.test/apps/starter-shopify-demo?preview=dep_starter-shopify-demo_preview_1');
  });

  it('TC-PC-105 keeps Shopify starter navigation out of workflow/canvas primary UI', () => {
    const artifactText = JSON.stringify(starterAppTemplate);
    assert.equal('routes' in starterAppTemplate, false);
    assert.equal('navigation' in starterAppTemplate, false);
    for (const forbidden of [/workflow/i, /canvas/i, /case[- ]?first/i, /n8n/i, /react flow/i]) {
      assert.doesNotMatch(artifactText, forbidden, `starter must not expose ${forbidden} as its primary UI model`);
    }
    assert.match(artifactText, /Product Browser/);
    assert.match(artifactText, /Connect store/);
  });

  it('TC-PC-104 rejects TODO placeholders and fake success states in starter artifacts', () => {
    const artifactText = JSON.stringify(starterAppTemplate);
    const forbiddenPlaceholderOrFakeSuccess = [
      /\bTODO\b/i,
      /lorem ipsum/i,
      /coming soon/i,
      /not implemented/i,
      /fake success/i,
      /successfully (deployed|synced|connected).*mock/i,
      /unverified .*success/i,
    ];

    for (const forbidden of forbiddenPlaceholderOrFakeSuccess) {
      assert.doesNotMatch(artifactText, forbidden, `starter artifact must not contain ${forbidden}`);
    }

    const connector = starterAppTemplate.components.find(c => c.name === STARTER_APP_CONNECTOR_NAME)!;
    assert.match(connector.code, /error: 'NEED_SETUP'/);
    assert.match(connector.code, /return \{ ok: true, products \}/);
  });
});
