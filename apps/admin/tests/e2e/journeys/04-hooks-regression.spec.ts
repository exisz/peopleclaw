/**
 * REGRESSION: PLANET-1436 — Rules of Hooks violation on /app/:id
 *
 * The /app/:id route previously white-screened due to "Rendered more hooks
 * than during the previous render" — a React hooks order violation.
 *
 * This test:
 * 1. Navigates to /app/:id (any existing app)
 * 2. Listens for pageerror containing "hook" keywords
 * 3. Asserts the page renders (not blank/crashed)
 */
import { test, expect } from '../fixtures/auth';

test.describe('PLANET-1436: Hooks violation regression', () => {
  test('/app/:id does not crash with hooks error', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(90_000);

    const hooksErrors: string[] = [];

    page.on('pageerror', (err) => {
      const msg = err.message.toLowerCase();
      if (msg.includes('hook') || msg.includes('rendered more') || msg.includes('rendered fewer')) {
        hooksErrors.push(err.message);
      }
    });

    // Go to /apps list first to find an existing app
    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 30_000 });

    // Find the first app link — they navigate to /app/:id
    const appLink = page.locator('a[href^="/app/"]').first();
    const hasApp = await appLink.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasApp) {
      // No apps exist — create one via template picker
      const createCard = page.locator('[data-testid="create-new-app-card"]');
      await createCard.click({ timeout: 5_000 });
      const picker = page.locator('[data-testid="template-picker-overlay"]');
      await picker.waitFor({ state: 'visible', timeout: 5_000 });
      await page.locator('[data-testid="template-starter-app-btn"]').click();
      await page.waitForURL(/\/app\/[a-zA-Z0-9-]+/, { timeout: 30_000 });
    } else {
      await appLink.click();
      await page.waitForURL(/\/app\/[a-zA-Z0-9-]+/, { timeout: 15_000 });
    }

    // Wait for page to settle
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Assert page didn't crash — should see canvas or chat input
    const canvas = page.locator('[data-testid="canvas-pane"]');
    const chatInput = page.locator('[data-testid="chat-input"]');
    const root = page.locator('#__next, #root, [data-testid="app-layout"]');

    const hasContent = await Promise.any([
      canvas.isVisible({ timeout: 5_000 }),
      chatInput.isVisible({ timeout: 5_000 }),
      root.isVisible({ timeout: 5_000 }),
    ]).catch(() => false);

    expect(hasContent, 'Page should render content (not blank/crashed)').toBeTruthy();

    // Assert no hooks errors
    expect(
      hooksErrors,
      `Hooks violation detected:\n${hooksErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('/app/:id survives navigation back and forth', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(60_000);

    const hooksErrors: string[] = [];
    page.on('pageerror', (err) => {
      const msg = err.message.toLowerCase();
      if (msg.includes('hook') || msg.includes('rendered more') || msg.includes('rendered fewer')) {
        hooksErrors.push(err.message);
      }
    });

    // Navigate to apps list
    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 30_000 });

    const appLink = page.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'No apps available to test navigation');
      return;
    }

    // Navigate to app
    await appLink.click();
    await page.waitForURL(/\/app\//, { timeout: 15_000 });
    await page.waitForTimeout(1500);

    // Go back to list
    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 15_000 });
    await page.waitForTimeout(500);

    // Navigate to app again (this is where hooks errors often appear on re-render)
    await appLink.click();
    await page.waitForURL(/\/app\//, { timeout: 15_000 });
    await page.waitForTimeout(2000);

    expect(hooksErrors, `Hooks violation on re-navigation:\n${hooksErrors.join('\n')}`).toHaveLength(0);
  });
});
