/**
 * PLANET-1742: Living SaaS flat routing regression.
 *
 * The old IDE top-tab route layer was removed. Component/user pages are
 * sidebar peer routes with normal URLs.
 */
import { test, expect } from '../fixtures/auth';

test.describe('TC10: flat App routing replaces IDE top tabs', () => {
  test('component page opens from sidebar/canvas route without content top tabs', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(180_000);

    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 15_000 });
    await page.getByTestId('create-new-app-card').click({ timeout: 10_000 });
    await page.getByTestId('template-starter-app-btn').click();
    await page.waitForURL(/\/app\/[^/]+\/canvas$/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 });

    const appId = page.url().match(/\/app\/([^/]+)/)?.[1];
    expect(appId).toBeTruthy();

    const nodeLocator = page.locator('[data-canvas-node="true"]');
    await expect(nodeLocator).toHaveCount(4, { timeout: 30_000 });
    await expect(page.getByTestId('ide-tab-bar')).toHaveCount(0);

    await page.getByTestId('inner-nav-modules').click();
    await expect(page).toHaveURL(new RegExp(`/app/${appId}/modules$`));
    await expect(page.getByTestId('page-app-modules')).toBeVisible();
    await expect(page.getByTestId('module-list-count')).toContainText('4');

    const firstRow = page.locator('[data-testid^="module-list-row-"]').first();
    const firstComponentId = (await firstRow.getAttribute('data-testid'))!.replace('module-list-row-', '');
    await firstRow.click();
    await expect(page).toHaveURL(new RegExp(`/app/${appId}/components/${firstComponentId}$`));
    await expect(page.getByTestId('page-app-component')).toBeVisible();
    await expect(page.getByTestId(`component-tab-content-${firstComponentId}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('ide-tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('tab-add-btn')).toHaveCount(0);

    await page.getByTestId('inner-nav-canvas').click();
    await expect(page).toHaveURL(new RegExp(`/app/${appId}/canvas$`));
    await expect(page.getByTestId('page-app-canvas')).toBeVisible();
    await expect(page.getByTestId('ide-tab-bar')).toHaveCount(0);
  });
});
