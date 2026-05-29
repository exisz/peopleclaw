import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { crmAppTemplate } from '../crm-app';
import { ecommerceStarterTemplate, type AppTemplate } from '../ecommerce-starter';
import { starterAppTemplate } from '../starter-app';

const FORBIDDEN_RUNTIME_JARGON = /\b(?:FULLSTACK|FRONTEND|BACKEND)\b/;

function collectShippableTemplateCopy(template: AppTemplate): string[] {
  const copy = [template.id, template.name, template.description];
  for (const component of template.components) {
    copy.push(component.name, component.icon, component.code);
  }
  return copy;
}

describe('starter template artifact wording', () => {
  it('TC-PC-141 keeps starter, CRM, and ecommerce shippable template records free of runtime component jargon', () => {
    const templates = [starterAppTemplate, crmAppTemplate, ecommerceStarterTemplate];
    const shippableCopy = templates.flatMap(collectShippableTemplateCopy);

    assert.ok(shippableCopy.some((copy) => /starter|crm|shopify|product|contact|商品|联系人/i.test(copy)), 'audit includes real business-facing starter copy');
    for (const copy of shippableCopy) {
      assert.doesNotMatch(copy, FORBIDDEN_RUNTIME_JARGON, `${copy.slice(0, 160)} must not expose runtime component type jargon`);
    }
  });
});


describe('ecommerce starter business wording', () => {
  it('TC-PC-148 keeps ecommerce artifacts and generated app descriptions free of runtime jargon', () => {
    const generatedDescriptionCopy = [
      ecommerceStarterTemplate.id,
      ecommerceStarterTemplate.name,
      ecommerceStarterTemplate.description,
      ...ecommerceStarterTemplate.components.flatMap(component => [component.name, component.icon, component.code]),
    ].join('\n');

    assert.match(generatedDescriptionCopy, /shopify|product|商品|电商/i);
    assert.doesNotMatch(generatedDescriptionCopy, FORBIDDEN_RUNTIME_JARGON);

    const source = readFileSync(new URL('../ecommerce-starter.ts', import.meta.url), 'utf8');
    const publicComments = source
      .split('\n')
      .filter((line) => line.trim().startsWith('*') || line.trim().startsWith('//'))
      .join('\n');
    assert.doesNotMatch(publicComments, FORBIDDEN_RUNTIME_JARGON);
  });
});
