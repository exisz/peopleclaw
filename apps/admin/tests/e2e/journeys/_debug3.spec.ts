import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test('DEBUG3: post-fix', async ({ authedPage }) => {
  const page = authedPage;
  test.setTimeout(180_000);
  page.on('console', msg => console.log(`[${msg.type()}]`, msg.text()));

  const app = new AppPage(page);
  await app.goto();
  await app.createFromStarterTemplate();
  await expect(app.canvas.nodeByType('FRONTEND')).toBeVisible({ timeout: 15_000 });
  await expect(app.canvas.nodeByType('BACKEND')).toBeVisible({ timeout: 15_000 });
  await expect(app.canvas.nodeByType('FULLSTACK')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('tab-module-list')).toContainText('(4)', { timeout: 5_000 });

  await page.getByTestId('tab-module-list').click();
  console.log('[A] active:', await page.evaluate(() => (document.querySelector('[data-tab-active="true"]') as HTMLElement | null)?.getAttribute('data-tab-id')));
  console.log('[A] tabs:', await page.locator('[data-tab-id]').evaluateAll(els => els.map(e => e.getAttribute('data-tab-id'))));

  const backendRow = page.locator('[data-testid^="module-list-row-"]').filter({ hasText: 'AI 换脸-处理' }).first();
  const backendCompId = (await backendRow.getAttribute('data-testid'))!.replace('module-list-row-', '');
  console.log('[B] backendId:', backendCompId);
  await backendRow.click();
  await page.waitForTimeout(800);
  console.log('[C] active:', await page.evaluate(() => (document.querySelector('[data-tab-active="true"]') as HTMLElement | null)?.getAttribute('data-tab-id')));
  console.log('[C] tabs:', await page.locator('[data-tab-id]').evaluateAll(els => els.map(e => e.getAttribute('data-tab-id'))));
  console.log('[C] tab-comp visible:', await page.getByTestId(`tab-component-${backendCompId}`).isVisible());
  console.log('[C] tab-content count:', await page.locator(`[data-testid="component-tab-content-${backendCompId}"]`).count());
  console.log('[C] tab-content visible cnt:', await page.locator(`[data-testid="component-tab-content-${backendCompId}"]:visible`).count());
  // Get the parent panel hidden attr
  console.log('[C] parent panel hidden attr:', await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="component-tab-content-${id}"]`);
    if (!el) return 'NULL';
    let p = el.parentElement;
    while (p) {
      if (p.hasAttribute('data-testid')) return `${p.getAttribute('data-testid')} hidden=${p.hasAttribute('hidden')}`;
      p = p.parentElement;
    }
    return 'no testid parent';
  }, backendCompId));
});
