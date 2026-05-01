/**
 * PLANET-1434 + PLANET-1437: AI canvas control + apply_template idempotency
 *
 * Test 1: New app from starter template has exactly 3 nodes
 * Test 2: Chat-driven apply_template idempotency (LLM-dependent, fixme)
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC3: AI tool-calling 改画布', () => {
  test('starter-app template creates exactly 3 nodes', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(60_000);

    // Go to apps list to create from there (navigates to /app/:id after creation)
    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 15_000 });

    // Click create button on the apps list
    await page.getByTestId('create-new-app-card').click({ timeout: 10_000 });

    // Pick starter template from the overlay
    await page.getByTestId(TID.templateBtn('starter-app')).click();

    // Wait for navigation to the new app
    await page.waitForURL(/\/app\//, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 });

    // The starter template has exactly 3 components
    const nodeLocator = page.locator('[data-canvas-node="true"]');
    await expect(nodeLocator).toHaveCount(3, { timeout: 30_000 });
  });

  // LLM-dependent: DeepSeek tool-calling unreliable in CI.
  test.fixme('chat apply_template is idempotent — no duplicate nodes', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(180_000);

    const app = new AppPage(page);
    await app.goto();

    await app.openTemplatePicker();
    page.once('dialog', d => d.accept('Idempotency Test'));
    await page.getByTestId(TID.templateBlankBtn).click();

    await expect(page.getByTestId(TID.canvasPane)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-canvas-node="true"]')).toHaveCount(0, { timeout: 10_000 });

    await page.getByTestId(TID.chatInput).fill('套用 starter-app 模板');
    await page.getByTestId(TID.chatSendBtn).click();

    const nodeLocator = page.locator('[data-canvas-node="true"]');
    await expect(nodeLocator).toHaveCount(3, { timeout: 90_000 });

    await page.getByTestId(TID.chatInput).fill('再套用一次 starter-app 模板');
    await page.getByTestId(TID.chatSendBtn).click();
    await page.waitForTimeout(15_000);
    await expect(nodeLocator).toHaveCount(3);
  });
});
