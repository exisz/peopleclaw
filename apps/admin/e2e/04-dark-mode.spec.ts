/**
 * PLANET-1444: Dark mode — only light/dark themes, visual check.
 */
import { test, expect } from './fixtures/auth';

test.describe('PLANET-1444: Dark mode', () => {
  test('theme toggle switches to dark and renders properly', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    // Click theme toggle
    const toggle = authedPage.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();

    // documentElement should have .dark class
    const isDark = await authedPage.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);

    // Screenshot for visual verification
    await authedPage.screenshot({ path: 'test-results/dark-mode-full.png', fullPage: true });
  });

  test('no extra theme options in toggle (only light/dark)', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    // The theme toggle is now a simple button (not dropdown)
    // Old test ids for removed themes should not exist
    await expect(authedPage.getByTestId('theme-option-eye-care')).not.toBeVisible();
    await expect(authedPage.getByTestId('theme-option-green')).not.toBeVisible();
    await expect(authedPage.getByTestId('theme-option-gray')).not.toBeVisible();
  });
});
