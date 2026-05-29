import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, join } from 'node:path';
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


describe('TC-PC-158 Shopify starter source runtime-jargon absence', () => {
  it('keeps raw server/page runtime labels out of starter source comments and constants', () => {
    const source = readFileSync(new URL('../starter-app.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(source, /STARTER_APP_FULLSTACK/);
    assert.doesNotMatch(source, /FULLSTACK_CODE_TEMPLATE/);
    assert.doesNotMatch(source, /\b(?:BACKEND|FULLSTACK)\b/);
    assert.match(source, /SERVER_CALLABLE_COMPONENT_TYPE/);
    assert.match(source, /INTERACTIVE_PAGE_COMPONENT_TYPE/);
    assert.match(source, /STARTER_APP_PRODUCT_BROWSER_NAME/);
  });
});


describe('TC-PC-159 template test fixture quarantine', () => {
  it('keeps forbidden runtime-jargon literals only in explicit absence regression tests', () => {
    const templateDir = new URL('..', import.meta.url);
    const forbidden = /(?:TODO Stage 3|Published Apps|AI 换脸|公开此组件|\/workflows|ReactFlow|canvas|Canvas|workflow editor|probe graph|FULLSTACK|FRONTEND|BACKEND|Component is not)/;
    const offenders: string[] = [];

    function scan(dirUrl: URL) {
      const root = templateDir.pathname;
      for (const entry of readdirSync(dirUrl)) {
        const path = join(dirUrl.pathname, entry);
        const stat = statSync(path);
        if (stat.isDirectory()) {
          scan(new URL(entry + '/', dirUrl));
          continue;
        }
        if (!entry.endsWith('.test.ts')) continue;
        const rel = relative(root, path);
        const text = readFileSync(path, 'utf8');
        if (forbidden.test(text) && !rel.includes('absence/')) offenders.push(rel);
      }
    }

    scan(templateDir);
    assert.deepEqual(offenders, []);
  });
});
