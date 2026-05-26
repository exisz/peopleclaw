export const CRM_APP_TEMPLATE_APP_ID = 'crm';

type CreateContactInput = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string | string[];
};

type CrmAppStore = {
  insert(collection: 'contacts', row: Record<string, unknown>): { id: string } & Record<string, unknown>;
};

type CrmFunctionContext = {
  appStore: CrmAppStore;
  now?: () => Date;
};

function normalizeTags(tags: CreateContactInput['tags']): string[] {
  const values = Array.isArray(tags) ? tags : String(tags ?? '').split(',');
  return values.map(tag => tag.trim()).filter(Boolean);
}

export async function createContact(input: CreateContactInput, ctx: CrmFunctionContext) {
  const name = String(input.name ?? '').trim();
  if (!name) {
    return { ok: false as const, error: 'NAME_REQUIRED' };
  }

  const now = (ctx.now?.() ?? new Date()).toISOString();
  const contact = ctx.appStore.insert('contacts', {
    name,
    email: String(input.email ?? '').trim(),
    phone: String(input.phone ?? '').trim(),
    company: String(input.company ?? '').trim(),
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
  });

  return { ok: true as const, contact };
}

export const crmAppTemplateManifest = {
  appId: CRM_APP_TEMPLATE_APP_ID,
  name: 'CRM Starter',
  version: '1.0.0',
  routes: [
    { id: 'dashboard', path: '/apps/crm/dashboard', screen: 'screens/Dashboard.tsx' },
    { id: 'contacts', path: '/apps/crm/contacts', screen: 'screens/Contacts.tsx' },
    { id: 'chat', path: '/apps/crm/chat', screen: 'screens/Chat.tsx' },
    { id: 'system', path: '/apps/crm/system', screen: 'screens/System.tsx' },
  ],
} as const;


export const crmAppTemplateSidebar = {
  sections: [
    {
      id: 'app',
      title: 'CRM',
      kind: 'app',
      items: [
        { id: 'dashboard', label: 'Dashboard', routeId: 'dashboard' },
        { id: 'contacts', label: 'Contacts', routeId: 'contacts' },
        { id: 'chat', label: 'Chat', routeId: 'chat' },
      ],
    },
    {
      id: 'system',
      title: 'System',
      kind: 'system',
      items: [
        { id: 'system', label: 'System', routeId: 'system' },
      ],
    },
  ],
} as const;


export const crmAppTemplateCollections = [
  {
    name: 'contacts',
    fields: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      email: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      company: { type: 'string', required: false },
      tags: { type: 'string[]', required: false },
      createdAt: { type: 'datetime', required: true },
      updatedAt: { type: 'datetime', required: true },
    },
  },
  {
    name: 'followupNotes',
    fields: {
      id: { type: 'string', required: true },
      contactId: { type: 'string', required: true, references: 'contacts.id' },
      type: { type: 'enum', values: ['call', 'email', 'meeting'], required: true },
      note: { type: 'string', required: true },
      createdAt: { type: 'datetime', required: true },
    },
  },
] as const;
