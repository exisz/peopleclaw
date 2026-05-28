/**
 * PLANET-2197: App shell exposes only agent-code product surfaces.
 * Canvas / visual workflow / system internals must stay absent.
 */
import { test, expect } from './fixtures/auth';

test.describe('PLANET-2197: no Canvas or visual workflow shell', () => {
  test('per-App sidebar has Overview, Build App, Chat only', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'no apps available on this tenant');
      return;
    }
    const href = await appLink.getAttribute('href');
    const id = href?.match(/^\/app\/([^/]+)/)?.[1];
    expect(id, 'app id parsed from /app/<id> href').toBeTruthy();

    await authedPage.goto(`/app/${id}`);
    await authedPage.waitForLoadState('networkidle');
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/dashboard$`));

    await expect(authedPage.getByTestId('app-inner-sidebar')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-dashboard')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-build')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-chat')).toBeVisible();

    await expect(authedPage.getByTestId('inner-nav-canvas')).toHaveCount(0);
    await expect(authedPage.getByTestId('inner-nav-modules')).toHaveCount(0);
    await expect(authedPage.getByTestId('inner-nav-section-components')).toHaveCount(0);
    await expect(authedPage.getByTestId('inner-nav-section-system')).toHaveCount(0);
    await expect(authedPage.getByTestId('page-app-canvas')).toHaveCount(0);
    await expect(authedPage.locator('.react-flow')).toHaveCount(0);

    await authedPage.getByTestId('inner-nav-build').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/build$`));
    await expect(authedPage.getByTestId('page-app-build')).toBeVisible();

    await authedPage.getByTestId('inner-nav-chat').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/chat$`));
    await expect(authedPage.getByTestId('page-app-chat')).toBeVisible();
  });

  test('old Canvas URL is not a routed product surface', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'no apps available on this tenant');
      return;
    }
    const href = await appLink.getAttribute('href');
    const id = href?.match(/^\/app\/([^/]+)/)?.[1];
    expect(id).toBeTruthy();

    await authedPage.goto(`/app/${id}/canvas`);
    await authedPage.waitForLoadState('networkidle');
    await expect(authedPage.getByTestId('page-app-canvas')).toHaveCount(0);
    await expect(authedPage.locator('.react-flow')).toHaveCount(0);
  });
});
