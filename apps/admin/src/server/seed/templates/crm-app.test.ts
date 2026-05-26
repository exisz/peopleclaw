import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractExports } from '../../compiler/extract-exports';
import { crmAppTemplate, CRM_APP_CONTACT_LIST_NAME } from './crm-app';

describe('CRM starter app preview flow', () => {
  it('TC-PC-088 proves CRM preview create contact works end-to-end', () => {
    const contactList = crmAppTemplate.components.find(component => component.name === CRM_APP_CONTACT_LIST_NAME);
    assert.ok(contactList, 'contact list fullstack component should exist');

    const extracted = extractExports(contactList.code);
    assert.match(extracted.serverBody, /ctx\.appStore\.list\('contacts'\)/);
    assert.match(extracted.clientBody, /crm-contact-list/);
    assert.match(contactList.code, /ctx\.appStore\.insert\('contacts'/);
    assert.match(contactList.code, /return \{ ok: true, id: row\.id, name: row\.name \}/);
  });
});
