import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test('DEBUG4: post-second-fix', async ({ authedPage }) => {
  const page = authedPage;
  test.setTimeout(180_000);
  page.on('console', msg => console.log(`[${msg.type()}]`, msg.text()));

  const app = new AppPage(page);
  await app.goto();
  await app.createFromStarterTemplate();
  await expect(app.canvas.nodeByType('FRONTEND')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('tab-module-list')).toContainText('(4)', { timeout: 5_000 });
  await page.getByTestId('tab-module-list').click();
  const backendRow = page.locator('[data-testid^="module-list-row-"]').filter({ hasText: 'AI 换脸-处理' }).first();
  const backendCompId = (await backendRow.getAttribute('data-testid'))!.replace('module-list-row-', '');
  console.log('[B] click row');
  await backendRow.click();
  await page.waitForTimeout(1500);
  console.log('[C] active:', await page.evaluate(() => (document.querySelector('[data-tab-active="true"]') as HTMLElement | null)?.getAttribute('data-tab-id')));
  console.log('[C] tabs:', await page.locator('[data-tab-id]').evaluateAll(els => els.map(e => e.getAttribute('data-tab-id'))));
});
