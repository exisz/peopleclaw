/**
 * PLANET-1442: App detail page hides app switcher, shows back-to-apps.
 * PLANET-1443: Component detail defaults to 运行 (preview) tab.
 */
import { test, expect } from './fixtures/auth';

test.describe('PLANET-1442: App detail locked mode', () => {
  test('app detail hides app switcher and shows back link', async ({ authedPage }) => {
    // First go to /apps to get an app id
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    // Navigate to first app if available
    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (await appLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await appLink.click();
      await authedPage.waitForLoadState('networkidle');

      // Should see back-to-apps link
      await expect(authedPage.getByTestId('back-to-apps')).toBeVisible();

      // Should NOT see the app dropdown selector with multiple options
      const selector = authedPage.locator('[data-testid="app-selector"] select');
      await expect(selector).not.toBeVisible();

      // Should see locked app name
      await expect(authedPage.getByTestId('app-locked-name')).toBeVisible();

      // Sidebar should NOT be visible
      await expect(authedPage.getByTestId('apps-sidebar')).not.toBeVisible();
    }
  });
});

test.describe('PLANET-1443: Default tab is 运行', () => {
  test('component detail defaults to run tab', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (await appLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await appLink.click();
      await authedPage.waitForLoadState('networkidle');

      // Click a node on canvas (if any)
      const node = authedPage.locator('.react-flow__node').first();
      if (await node.isVisible({ timeout: 3000 }).catch(() => false)) {
        await node.click();
        // 运行 tab should be active by default
        const runTab = authedPage.getByTestId('detail-sub-tab-run');
        await expect(runTab).toBeVisible();
        await expect(runTab).toHaveClass(/bg-primary/);
      }
    }
  });
});
