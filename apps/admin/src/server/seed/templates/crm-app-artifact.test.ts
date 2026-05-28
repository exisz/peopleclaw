import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addFollowupNote, createContact, crmContactsScreenArtifact, crmAppTemplateManifest, crmAppTemplateSidebar, crmAppTemplateCollections, renderContactsScreenModel } from './crm-app-artifact';

type ManifestLike = {
  appId: string;
  name: string;
  version: string;
  routes: ReadonlyArray<{ id: string; path: string; screen: string }>;
};

function validateManifest(manifest: ManifestLike): string[] {
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
    const expectedRow = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '555-0100',
      company: 'Analytical Engines Ltd',
      tags: ['vip', 'analyst'],
      createdAt: '2026-05-26T14:05:00.000Z',
      updatedAt: '2026-05-26T14:05:00.000Z',
    };
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
          getById() {
            return null;
          },
        },
      },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(writes, [
      {
        collection: 'contacts',
        row: expectedRow,
      },
    ]);
    assert.deepEqual(result.contact, { id: 'contact_1', ...expectedRow });
  });

  it('TC-PC-086 proves addFollowupNote validates existing contact', async () => {
    const contacts = new Map<string, Record<string, unknown>>([
      ['contact_1', { id: 'contact_1', name: 'Ada Lovelace' }],
    ]);
    const writes: Array<{ collection: string; row: Record<string, unknown> }> = [];
    const expectedRow = {
      contactId: 'contact_1',
      type: 'meeting',
      note: 'Demo scheduled',
      createdAt: '2026-05-26T14:06:00.000Z',
    };
    const appStore = {
      insert(collection: 'contacts' | 'followupNotes', row: Record<string, unknown>) {
        writes.push({ collection, row });
        return { id: 'followup_1', ...row };
      },
      getById(collection: 'contacts', id: string) {
        return collection === 'contacts' ? contacts.get(id) as any ?? null : null;
      },
    };

    const missing = await addFollowupNote(
      { contactId: 'missing', type: 'meeting', note: 'Should not write' },
      { now: () => new Date('2026-05-26T14:06:00.000Z'), appStore },
    );
    assert.deepEqual(missing, { ok: false, error: 'CONTACT_NOT_FOUND' });
    assert.deepEqual(writes, []);

    const result = await addFollowupNote(
      { contactId: 'contact_1', type: 'meeting', note: ' Demo scheduled ' },
      { now: () => new Date('2026-05-26T14:06:00.000Z'), appStore },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(writes, [
      {
        collection: 'followupNotes',
        row: expectedRow,
      },
    ]);
    assert.deepEqual(result.followupNote, { id: 'followup_1', ...expectedRow });
  });


  it('TC-PC-087 proves contacts screen reads collection via React SDK', () => {
    const calls: string[] = [];
    const model = renderContactsScreenModel({
      useCollection(collection) {
        calls.push(collection);
        return {
          loading: false,
          documents: [
            { id: 'contact_1', name: 'Ada Lovelace' },
            { id: 'contact_2', name: 'Grace Hopper' },
          ],
        };
      },
    });

    assert.deepEqual(calls, ['contacts']);
    assert.deepEqual(model, {
      loading: false,
      errorMessage: null,
      contacts: [
        { id: 'contact_1', name: 'Ada Lovelace' },
        { id: 'contact_2', name: 'Grace Hopper' },
      ],
    });
    assert.equal(crmContactsScreenArtifact.path, 'screens/Contacts.tsx');
    assert.match(crmContactsScreenArtifact.source, /from '@peopleclaw\/sdk\/react'/);
    assert.match(crmContactsScreenArtifact.source, /useCollection\('contacts'\)/);
  });

});
