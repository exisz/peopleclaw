import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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


const FORBIDDEN_RUNTIME_JARGON = /\b(?:FULLSTACK|FRONTEND|BACKEND)\b|component type/i;

describe('CRM starter app business wording', () => {
  it('TC-PC-147 keeps CRM artifacts and generated app descriptions free of runtime jargon', () => {
    const generatedDescriptionCopy = [
      crmAppTemplate.id,
      crmAppTemplate.name,
      crmAppTemplate.description,
      ...crmAppTemplate.components.flatMap(component => [component.name, component.icon, component.code]),
    ].join('\n');

    assert.match(generatedDescriptionCopy, /CRM|联系人|跟进|contact/i);
    assert.doesNotMatch(generatedDescriptionCopy, FORBIDDEN_RUNTIME_JARGON);

    const sourceComments = readCrmTemplateSourceComments();
    assert.doesNotMatch(sourceComments, FORBIDDEN_RUNTIME_JARGON);
  });
});

function readCrmTemplateSourceComments(): string {
  const source = readFileSync(new URL('./crm-app.ts', import.meta.url), 'utf8');
  return source.split('\n').filter((line: string) => line.trim().startsWith('*') || line.trim().startsWith('//')).join('\n');
}
