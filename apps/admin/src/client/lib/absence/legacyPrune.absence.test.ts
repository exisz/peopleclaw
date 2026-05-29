import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

const clientRoot = new URL('../../', import.meta.url);
const adminRoot = new URL('../../', clientRoot);
const slash = '/';
const publishedRoute = slash + 'published';
const securityRoute = slash + 'security';
const oldFlowRoute = slash + 'work' + 'flows';
const shopName = 'Shop' + 'ify';
const internalTypeLabels = ['FULL' + 'STACK', 'FRONT' + 'END', 'BACK' + 'END'];

function readClient(path: string): string {
  return readFileSync(new URL(path, clientRoot), 'utf8');
}

function readAdmin(path: string): string {
  return readFileSync(new URL(path, adminRoot), 'utf8');
}

function collectTextFiles(rootPath: string): string[] {
  const root = new URL(rootPath, adminRoot);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (url: URL) => {
    for (const entry of readdirSync(url)) {
      if (['node_modules', '.next', 'dist', 'coverage', 'test-results', 'absence'].includes(entry)) continue;
      const child = new URL(entry + (entry.includes('.') ? '' : '/'), url);
      const stat = statSync(child);
      if (stat.isDirectory()) {
        walk(new URL(entry + '/', url));
      } else if (/\.(ts|tsx|js|jsx|md|json)$/.test(entry)) {
        out.push(readFileSync(child, 'utf8'));
      }
    }
  };
  walk(root);
  return out;
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

  it('does not expose app-building internals in customer-facing app shell files', () => {
    const userFacingSources = [
      readClient('main.tsx'),
      readClient('components/layout/AppInnerShell.tsx'),
      readClient('pages/AppsList.tsx'),
      readClient('pages/app/AppDashboardPage.tsx'),
      readClient('pages/app/AppBuildPage.tsx'),
      readClient('pages/app/AppChatPage.tsx'),
    ].join('\n');

    const forbiddenText = [
      'AI 换脸' + '-处理',
      'AI 换脸' + '-表单',
      '公开' + '此组件',
      'Module Flow',
      'Runners',
      'Connect Codex',
      'Secrets',
      'Logs',
      'Canvas',
      '/canvas',
      'canvas-pane',
      'React Flow',
      'workflow editor',
      'no-code',
      'Modules',
      'App Page',
      'component entries',
      'Run backend',
    ];

    for (const term of [...forbiddenText, ...internalTypeLabels]) {
      assert.equal(userFacingSources.includes(term), false, `unexpected user-facing internal label: ${term}`);
    }
  });

  it('keeps shipped docs, seed templates, and e2e clear of old workflow and face-swap surfaces', () => {
    const sources = [
      readAdmin('README.md'),
      ...collectTextFiles('e2e/'),
      ...collectTextFiles('tests/e2e/'),
      ...collectTextFiles('src/server/seed/templates/'),
    ].join('\n');

    const forbiddenText = [
      oldFlowRoute,
      'workflow editor',
      'React Flow',
      'no-code',
      'AI 换脸' + '-处理',
      'AI 换脸' + '-表单',
      '公开' + '此组件',
    ];

    for (const term of forbiddenText) {
      assert.equal(sources.includes(term), false, `unexpected legacy shipped surface: ${term}`);
    }
  });

});
