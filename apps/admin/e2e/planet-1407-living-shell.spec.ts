/**
 * PLANET-1407: Living SaaS shell — App-level navigation surface.
 *
 * Verifies the new opt-in inner shell at /app/:id/<section> shows the
 * App + System sidebar sections, navigates between Dashboard / Chat /
 * System pages without losing the shell, and keeps the legacy
 * /app/:id dual-pane experience intact (no inner sidebar there).
 */
import { test, expect } from './fixtures/auth';

test.describe('PLANET-1407: Living SaaS inner shell', () => {
  test('inner shell renders sidebar + nav between Dashboard / Chat / Secrets', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'no apps available on this tenant');
      return;
    }

    // Extract app id from href and jump straight into the new shell.
    const href = await appLink.getAttribute('href');
    const id = href?.match(/^\/app\/([^/]+)/)?.[1];
    expect(id, 'app id parsed from /app/<id> href').toBeTruthy();

    await authedPage.goto(`/app/${id}/dashboard`);
    await authedPage.waitForLoadState('networkidle');

    // Inner shell present
    await expect(authedPage.getByTestId('app-inner-sidebar')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-section-app')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-section-system')).toBeVisible();
    await expect(authedPage.getByTestId('page-app-dashboard')).toBeVisible();

    // Chat is a page, reachable via sidebar nav (not an always-on middle pane).
    await authedPage.getByTestId('inner-nav-chat').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/chat$`));
    await expect(authedPage.getByTestId('page-app-chat')).toBeVisible();
    await expect(authedPage.getByTestId('page-chat-input')).toBeVisible();

    // System / Secrets nav lands on the secrets page.
    await authedPage.getByTestId('inner-nav-system-secrets').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/system/secrets$`));
    await expect(authedPage.getByTestId('page-app-system-secrets')).toBeVisible();
  });

  test('legacy /app/:id dual pane is preserved (no inner sidebar)', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'no apps available on this tenant');
      return;
    }
    await appLink.click();
    await authedPage.waitForLoadState('networkidle');

    // Old dual-pane chat input still mounts on /app/:id.
    await expect(authedPage.getByTestId('chat-input')).toBeVisible();
    // The new inner-shell sidebar must NOT be present here — preserves
    // existing E2E expectations against the locked dual-pane view.
    await expect(authedPage.getByTestId('app-inner-sidebar')).toHaveCount(0);
  });
});
