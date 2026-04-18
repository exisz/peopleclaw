import { test, expect } from './fixtures/auth';

test.describe('Workflow editor smoke', () => {
  test('opens editor for shopify-product-listing-demo and shows save indicator', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.waitForURL(/\/workflows/);

    // Click the demo workflow (text match — stable enough as seed name)
    const demo = authedPage.getByText(/shopify-product-listing-demo/i).first();
    await expect(demo).toBeVisible({ timeout: 15_000 });
    await demo.click();

    // Editor mounts — properties tab + save indicator are reliable testids
    await expect(authedPage.getByTestId('tab-properties')).toBeVisible({ timeout: 15_000 });
    // Save indicator can be in any state — assert any of the variants exists
    const saveIndicator = authedPage.locator('[data-testid^="save-indicator-"]');
    await expect(saveIndicator.first()).toBeVisible();
  });

  test('shortcut help dialog opens via help icon (PLANET-928)', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.getByText(/shopify-product-listing-demo/i).first().click();
    await expect(authedPage.getByTestId('shortcut-help-button')).toBeVisible({ timeout: 15_000 });
    await authedPage.getByTestId('shortcut-help-button').click();
    await expect(authedPage.getByTestId('shortcut-help-overlay')).toBeVisible();
    await authedPage.keyboard.press('Escape');
    await expect(authedPage.getByTestId('shortcut-help-overlay')).not.toBeVisible();
  });
});
