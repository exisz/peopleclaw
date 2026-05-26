import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderAppSidebarFromManifest } from './appSidebarManifest';

describe('PeopleClaw App sidebar manifest rendering', () => {
  it('TC-PC-015 renders App sidebar items from sidebar.json5 data instead of hardcoded core nav', () => {
    const rendered = renderAppSidebarFromManifest('demo-crm', {
      sections: [
        {
          id: 'crm',
          title: 'CRM',
          items: [
            { id: 'leads', label: 'Lead Pipeline', path: '/leads' },
            { id: 'accounts', label: 'Accounts', path: '/accounts' },
          ],
        },
      ],
    });

    assert.deepEqual(rendered, [
      { id: 'crm:leads', label: 'Lead Pipeline', href: '/apps/demo-crm/leads' },
      { id: 'crm:accounts', label: 'Accounts', href: '/apps/demo-crm/accounts' },
    ]);
    assert.equal(rendered.some(item => item.label === 'Settings' || item.label === 'Apps'), false);
  });
});
