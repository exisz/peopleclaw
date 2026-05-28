/** PLANET-1442: App detail hides outer app switcher, shows back-to-apps. */
import { test, expect } from './fixtures/auth';

test.describe('PLANET-1442: App detail locked mode', () => {
  test('app detail hides outer sidebar and shows back link', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'no apps available on this tenant');
      return;
    }

    await appLink.click();
    await authedPage.waitForLoadState('networkidle');
    await expect(authedPage.getByTestId('back-to-apps')).toBeVisible();
    await expect(authedPage.locator('[data-testid="app-selector"] select')).not.toBeVisible();
    await expect(authedPage.getByTestId('app-locked-name')).toBeVisible();
    await expect(authedPage.getByTestId('apps-sidebar')).not.toBeVisible();
  });
});
