/**
 * PLANET-1407: Living SaaS shell — canonical inner navigation.
 *
 * The Chat/Canvas dual-pane has been removed. /app/:id redirects to
 * /app/:id/canvas, and Chat is reachable as a real page via the sidebar.
 */
import { test, expect } from './fixtures/auth';

test.describe('PLANET-1407: Living SaaS inner shell', () => {
  test('inner shell renders sidebar + nav between Canvas / Chat / Secrets', async ({ authedPage }) => {
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

    // /app/:id should redirect to canvas under the canonical shell.
    await authedPage.goto(`/app/${id}`);
    await authedPage.waitForLoadState('networkidle');
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/canvas$`));
    await expect(authedPage.getByTestId('app-inner-sidebar')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-section-app')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-section-system')).toBeVisible();
    await expect(authedPage.getByTestId('page-app-canvas')).toBeVisible();

    // Chat is a navigable page (not an always-on middle pane).
    await authedPage.getByTestId('inner-nav-chat').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/chat$`));
    await expect(authedPage.getByTestId('page-app-chat')).toBeVisible();
    await expect(authedPage.getByTestId('chat-input')).toBeVisible();
    await expect(authedPage.getByTestId('chat-send-btn')).toBeVisible();

    // System / Secrets nav lands on the secrets page.
    await authedPage.getByTestId('inner-nav-system-secrets').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/system/secrets$`));
    await expect(authedPage.getByTestId('page-app-system-secrets')).toBeVisible();

    // Dashboard nav lands on the dashboard.
    await authedPage.getByTestId('inner-nav-dashboard').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/dashboard$`));
    await expect(authedPage.getByTestId('page-app-dashboard')).toBeVisible();
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

    // Inner shell is mounted; the outer Apps sidebar (top-level nav) is not.
    await expect(authedPage.getByTestId('app-inner-sidebar')).toBeVisible();
    await expect(authedPage.getByTestId('apps-sidebar')).toHaveCount(0);
  });
});
