/**
 * PLANET-1407 / PLANET-1742: Living SaaS shell — canonical inner navigation.
 *
 * Sidebar navigation is the route source of truth. App, system, and
 * user/business component pages are peer entries in the left App sidebar;
 * there is no legacy content-level top route/tab row.
 */
import { test, expect } from './fixtures/auth';

test.describe('PLANET-1742: flat Living SaaS inner shell', () => {
  test('sidebar drives App + System routes and no legacy top tab route is rendered', async ({ authedPage }) => {
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
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/canvas$`));
    await expect(authedPage.getByTestId('app-inner-sidebar')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-section-app')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-section-components')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-section-system')).toBeVisible();
    await expect(authedPage.getByTestId('page-app-canvas')).toBeVisible();

    // PLANET-1742: no right-content top route/tab row on Canvas.
    await expect(authedPage.getByTestId('ide-tab-bar')).toHaveCount(0);
    await expect(authedPage.getByTestId('tab-flow-graph')).toHaveCount(0);
    await expect(authedPage.getByTestId('tab-app-secrets')).toHaveCount(0);
    await expect(authedPage.getByTestId('tab-app-scheduled')).toHaveCount(0);

    // Modules is a navigable App page, not a content-level tab.
    await authedPage.getByTestId('inner-nav-modules').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/modules$`));
    await expect(authedPage.getByTestId('page-app-modules')).toBeVisible();
    await expect(authedPage.getByTestId('ide-tab-bar')).toHaveCount(0);

    // Chat is a navigable page (not an always-on middle pane).
    await authedPage.getByTestId('inner-nav-chat').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/chat$`));
    await expect(authedPage.getByTestId('page-app-chat')).toBeVisible();
    await expect(authedPage.getByTestId('chat-input')).toBeVisible();
    await expect(authedPage.getByTestId('chat-send-btn')).toBeVisible();
    await expect(authedPage.getByTestId('ide-tab-bar')).toHaveCount(0);

    // System nav is a first-class sidebar route.
    await authedPage.getByTestId('inner-nav-system-secrets').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/system/secrets$`));
    await expect(authedPage.getByTestId('page-app-system-secrets')).toBeVisible();
    await expect(authedPage.getByTestId('ide-tab-bar')).toHaveCount(0);

    // Dashboard nav lands on the dashboard.
    await authedPage.getByTestId('inner-nav-dashboard').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/dashboard$`));
    await expect(authedPage.getByTestId('page-app-dashboard')).toBeVisible();
  });

  test('user/business component pages are sidebar peer routes when fixtures provide components', async ({ authedPage }) => {
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

    const componentLink = authedPage.locator('[data-testid^="inner-nav-component-"]').first();
    if (!(await componentLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'selected app has no user/business component pages');
      return;
    }

    await componentLink.click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/components/[^/]+$`));
    await expect(authedPage.getByTestId('page-app-component')).toBeVisible();
    await expect(authedPage.getByTestId('ide-tab-bar')).toHaveCount(0);
  });

  test('the legacy outer apps-sidebar is not rendered inside an App', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'no apps available on this tenant');
      return;
    }
    await appLink.click();
    await authedPage.waitForLoadState('networkidle');

    await expect(authedPage.getByTestId('app-inner-sidebar')).toBeVisible();
    await expect(authedPage.getByTestId('apps-sidebar')).toHaveCount(0);
  });
});
