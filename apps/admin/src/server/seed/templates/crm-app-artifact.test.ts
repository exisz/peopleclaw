import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crmAppTemplateManifest, crmAppTemplateSidebar } from './crm-app-artifact';

function validateManifest(manifest: typeof crmAppTemplateManifest): string[] {
  const errors: string[] = [];
  if (!manifest.appId) errors.push('appId is required');
  if (!manifest.name) errors.push('name is required');
  if (!manifest.version) errors.push('version is required');
  if (!Array.isArray(manifest.routes) || manifest.routes.length === 0) errors.push('routes are required');
  const routeIds = new Set<string>();
  for (const route of manifest.routes) {
    if (routeIds.has(route.id)) errors.push(`duplicate route id: ${route.id}`);
    routeIds.add(route.id);
    if (!route.path.startsWith(`/apps/${manifest.appId}/`)) errors.push(`route outside app namespace: ${route.path}`);
    if (!route.screen.startsWith('screens/')) errors.push(`route screen must point at screens/: ${route.screen}`);
  }
  return errors;
}

describe('CRM starter app artifact template', () => {
  it('TC-PC-081 proves crm template manifest validates', () => {
    assert.deepEqual(validateManifest(crmAppTemplateManifest), []);
    assert.deepEqual(crmAppTemplateManifest.routes.map(route => route.id), ['dashboard', 'contacts', 'chat', 'system']);
  });
});


describe('CRM starter app artifact sidebar', () => {
  it('TC-PC-082 proves crm sidebar has dashboard contacts chat system pages', () => {
    const itemRouteIds = crmAppTemplateSidebar.sections.flatMap(section => section.items.map(item => item.routeId));
    assert.deepEqual(itemRouteIds, ['dashboard', 'contacts', 'chat', 'system']);
    assert.deepEqual(new Set(itemRouteIds), new Set(crmAppTemplateManifest.routes.map(route => route.id)));
    assert.equal(crmAppTemplateSidebar.sections.at(-1)?.kind, 'system');
  });
});
