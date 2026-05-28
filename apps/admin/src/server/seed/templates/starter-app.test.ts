import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { planStarterAppPreviewDeployment, starterAppTemplate, STARTER_APP_CONNECTOR_NAME, STARTER_APP_FULLSTACK_NAME, validateStarterAppConnectorSurface, verifyStarterPreviewDeployment } from './starter-app';

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
