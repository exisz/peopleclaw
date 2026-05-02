/**
 * PLANET-1468: IDE-style multi-tab UI.
 *
 * Verifies tab open/switch/close/reopen + reload persistence + permanent-tab no-close.
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';

test.describe('TC10: IDE 多 tab', () => {
  test('打开/切换/关闭/重开 + reload 持久化', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(180_000);

    const app = new AppPage(page);
    // Use /apps flow so the URL contains the app id (so reload restores the same app)
    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 15_000 });
    await page.getByTestId('create-new-app-card').click({ timeout: 10_000 });
    await page.getByTestId('template-starter-app-btn').click();
    await page.waitForURL(/\/app\//, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    void app;

    const nodeLocator = page.locator('[data-canvas-node="true"]');
    await expect(nodeLocator).toHaveCount(4, { timeout: 30_000 });

    // Permanent tabs visible, no close button
    for (const id of ['tab-flow-graph', 'tab-module-list', 'tab-app-secrets', 'tab-app-scheduled']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    for (const id of ['flow', 'list', 'secrets', 'scheduled']) {
      expect(await page.getByTestId(`tab-close-${id}`).count()).toBe(0);
    }

    // Open first component tab via canvas click
    const firstNode = nodeLocator.nth(0);
    const firstNodeId = (await firstNode.getAttribute('data-testid'))!.replace('canvas-node-', '');
    await firstNode.click();
    const tabA = page.getByTestId(`tab-component-${firstNodeId}`);
    await expect(tabA).toBeVisible({ timeout: 5_000 });
    await expect(tabA).toHaveAttribute('data-tab-active', 'true');
    await expect(page.getByTestId(`tab-close-${firstNodeId}`)).toBeVisible();

    // Open second component tab via [+] menu
    await page.getByTestId('tab-add-btn').click();
    await expect(page.getByTestId('tab-add-menu')).toBeVisible();
    const firstAddOption = page.getByTestId('tab-add-menu').locator('[data-testid^="tab-add-option-"]').first();
    const secondNodeId = (await firstAddOption.getAttribute('data-testid'))!.replace('tab-add-option-', '');
    expect(secondNodeId).not.toBe(firstNodeId);
    await firstAddOption.click();

    const tabB = page.getByTestId(`tab-component-${secondNodeId}`);
    await expect(tabB).toBeVisible();
    await expect(tabB).toHaveAttribute('data-tab-active', 'true');
    await expect(tabA).toBeVisible(); // first still around

    // Switch back to A
    await tabA.click();
    await expect(tabA).toHaveAttribute('data-tab-active', 'true');

    // [+] menu must NOT list already-open components
    await page.getByTestId('tab-add-btn').click();
    expect(await page.getByTestId(`tab-add-option-${firstNodeId}`).count()).toBe(0);
    expect(await page.getByTestId(`tab-add-option-${secondNodeId}`).count()).toBe(0);
    await page.getByTestId('tab-add-btn').click(); // close menu

    // Reload page → tabs restored from localStorage
    const url = page.url();
    await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });
    await expect(nodeLocator).toHaveCount(4, { timeout: 30_000 });
    await expect(page.getByTestId(`tab-component-${firstNodeId}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`tab-component-${secondNodeId}`)).toBeVisible();

    const appId = url.match(/\/app\/([^/?#]+)/)?.[1];
    if (appId) {
      const stored = await page.evaluate((k) => localStorage.getItem(k), `peopleclaw:openTabs:${appId}`);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(Array.isArray(parsed.openTabIds)).toBe(true);
      expect(parsed.openTabIds).toContain(firstNodeId);
      expect(parsed.openTabIds).toContain(secondNodeId);
      expect(parsed.openTabIds).toContain('flow');
      expect(parsed.openTabIds).toContain('list');
    }

    // Close A — make B active first to avoid clicking active tab close (auto-detach quirk)
    await page.getByTestId(`tab-component-${secondNodeId}`).click();
    await page.waitForTimeout(200);
    await page.getByTestId(`tab-close-${firstNodeId}`).click({ force: true });
    await expect(page.getByTestId(`tab-component-${firstNodeId}`)).toHaveCount(0, { timeout: 5_000 });
    // B still around and active
    await expect(page.getByTestId(`tab-component-${secondNodeId}`)).toBeVisible();
    await expect(page.getByTestId(`tab-component-${secondNodeId}`)).toHaveAttribute('data-tab-active', 'true');

    // Re-open A via [+] menu
    await page.getByTestId('tab-add-btn').click();
    await page.getByTestId(`tab-add-option-${firstNodeId}`).click();
    await expect(page.getByTestId(`tab-component-${firstNodeId}`)).toBeVisible();

    // Close all component tabs
    await page.getByTestId(`tab-close-${firstNodeId}`).click({ force: true });
    await expect(page.getByTestId(`tab-component-${firstNodeId}`)).toHaveCount(0, { timeout: 5_000 });
    await page.getByTestId(`tab-close-${secondNodeId}`).click({ force: true });
    await expect(page.getByTestId(`tab-component-${secondNodeId}`)).toHaveCount(0, { timeout: 5_000 });
    // After closing all, active falls back to flow (since secondNode was active)
    await expect(page.getByTestId('tab-flow-graph')).toHaveAttribute('data-tab-active', 'true');
  });
});
