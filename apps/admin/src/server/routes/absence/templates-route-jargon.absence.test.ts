import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const RAW_RUNTIME_JARGON = /\b(?:FULLSTACK|FRONTEND|BACKEND)\b/;

describe('TC-PC-157 template provisioning route runtime-jargon absence', () => {
  it('keeps raw runtime component labels out of the production route source', () => {
    const source = readFileSync(new URL('../templates.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(source, RAW_RUNTIME_JARGON);
    assert.doesNotMatch(source, /STARTER_APP_FULLSTACK_NAME/);
  });

  it('still preserves two-pass starter app creation and placeholder patching behavior', () => {
    const source = readFileSync(new URL('../templates.ts', import.meta.url), 'utf8');

    assert.match(source, /INTERACTIVE_APP_PAGE_TYPE/);
    assert.match(source, /create callable\/helper modules/);
    assert.match(source, /before we patch the interactive page module/);
    assert.match(source, /replace\(\/__APP_ID__\/g, newApp\.id\)/);
    assert.match(source, /replace\(\/__CONNECTOR_ID__\/g, connectorId \?\? ''\)/);
    assert.match(source, /comp\.name === STARTER_APP_PRODUCT_BROWSER_NAME/);
  });
});
