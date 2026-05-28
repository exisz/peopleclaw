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

  it('TC-PC-2201 keeps the store integration sidecar wired to a renderable product list', () => {
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

    assert.ok(
      starterAppTemplate.connections.some(c => c.fromIndex === connectorIndex && c.toIndex === fullstackIndex && c.type === 'DATA_FLOW'),
      'store data source is wired to the product browser',
    );
  });

  it('TC-PC-2202 keeps Shopify setup out of global Settings', () => {
    const settingsSource = readFileSync(new URL('../../../client/pages/Settings.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(settingsSource, /SettingsConnections/);
    assert.doesNotMatch(settingsSource, /settings-tab-connections/);
    assert.match(settingsSource, /Team and Billing settings/);

    const connector = starterAppTemplate.components.find(c => c.name === STARTER_APP_CONNECTOR_NAME)!;
    assert.match(connector.code, /SHOPIFY_SHOP_DOMAIN/);
    assert.match(connector.code, /SHOPIFY_ADMIN_TOKEN|SHOPIFY_CLIENT_ID/);
  });
});
