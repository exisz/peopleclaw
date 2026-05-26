export const CRM_APP_TEMPLATE_APP_ID = 'crm';

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
] as const;
