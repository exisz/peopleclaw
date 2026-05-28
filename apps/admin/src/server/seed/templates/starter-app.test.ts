import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { starterAppTemplate, STARTER_APP_CONNECTOR_NAME, STARTER_APP_FULLSTACK_NAME } from './starter-app';

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
