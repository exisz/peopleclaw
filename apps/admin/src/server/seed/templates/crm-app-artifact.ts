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
