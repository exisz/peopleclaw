import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const clientRoot = new URL('../', import.meta.url);
const slash = '/';
const publishedRoute = slash + 'published';
const securityRoute = slash + 'security';
const oldFlowRoute = slash + 'work' + 'flows';
const shopName = 'Shop' + 'ify';

function readClient(path: string): string {
  return readFileSync(new URL(path, clientRoot), 'utf8');
}

describe('legacy non-spec surfaces stay pruned', () => {
  it('does not expose top-level placeholder routes for future publish/security surfaces', () => {
    const main = readClient('main.tsx');
    const sidebar = readClient('components/AppsSidebar.tsx');
    assert.equal(main.includes('Published ' + 'Apps'), false);
    assert.equal(main.includes(`path="${publishedRoute}"`), false);
    assert.equal(main.includes(`path="${securityRoute}"`), false);
    assert.equal(sidebar.includes('Published'), false);
    assert.equal(sidebar.includes('Security'), false);
  });

  it('does not expose workspace-level connector setup from Settings', () => {
    const settings = readClient('pages/Settings.tsx');
    const en = readClient('i18n/locales/en/settings.json');
    const zh = readClient('i18n/locales/zh/settings.json');
    for (const source of [settings, en, zh]) {
      assert.equal(source.includes(shopName), false);
      assert.equal(source.includes('connections'), false);
      assert.equal(source.includes('work' + 'flow steps'), false);
    }
  });

  it('keeps old route fallbacks pointed at Apps, not old flow lists', () => {
    const main = readClient('main.tsx');
    const boundary = readClient('components/ErrorBoundary.tsx');
    assert.equal(main.includes(oldFlowRoute), false);
    assert.equal(boundary.includes(oldFlowRoute), false);
    assert.equal(boundary.includes('回到 Apps'), true);
  });
});
