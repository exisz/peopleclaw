import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createContact, crmAppTemplateManifest, crmAppTemplateSidebar, crmAppTemplateCollections } from './crm-app-artifact';

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


describe('CRM starter app artifact data collections', () => {
  it('TC-PC-083 proves contacts collection schema validates', () => {
    const contacts = crmAppTemplateCollections.find(collection => collection.name === 'contacts');
    assert.ok(contacts, 'contacts collection should exist');
    assert.deepEqual(Object.keys(contacts.fields), ['id', 'name', 'email', 'phone', 'company', 'tags', 'createdAt', 'updatedAt']);
    assert.equal(contacts.fields.name.required, true);
    assert.equal(contacts.fields.email.type, 'string');
    assert.equal(contacts.fields.tags.type, 'string[]');
  });
});


  it('TC-PC-084 proves followupNotes collection schema validates', () => {
    const followupNotes = crmAppTemplateCollections.find(collection => collection.name === 'followupNotes');
    assert.ok(followupNotes, 'followupNotes collection should exist');
    assert.deepEqual(Object.keys(followupNotes.fields), ['id', 'contactId', 'type', 'note', 'createdAt']);
    assert.equal(followupNotes.fields.contactId.references, 'contacts.id');
    assert.deepEqual(followupNotes.fields.type.values, ['call', 'email', 'meeting']);
    assert.equal(followupNotes.fields.note.required, true);
  });

describe('CRM starter app functions', () => {
  it('TC-PC-085 proves createContact function writes contact', async () => {
    const writes: Array<{ collection: string; row: Record<string, unknown> }> = [];
    const result = await createContact(
      {
        name: '  Ada Lovelace  ',
        email: ' ada@example.com ',
        phone: ' 555-0100 ',
        company: ' Analytical Engines Ltd ',
        tags: 'vip, analyst, ',
      },
      {
        now: () => new Date('2026-05-26T14:05:00.000Z'),
        appStore: {
          insert(collection, row) {
            writes.push({ collection, row });
            return { id: 'contact_1', ...row };
          },
        },
      },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(writes, [
      {
        collection: 'contacts',
        row: {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          phone: '555-0100',
          company: 'Analytical Engines Ltd',
          tags: ['vip', 'analyst'],
          createdAt: '2026-05-26T14:05:00.000Z',
          updatedAt: '2026-05-26T14:05:00.000Z',
        },
      },
    ]);
    assert.deepEqual(result.contact, { id: 'contact_1', ...writes[0].row });
  });
});
