import { test, expect } from './fixtures/auth';

test.describe('Auth + nav smoke', () => {
  test('signs in and lands on dashboard with workflows nav visible', async ({ authedPage }) => {
    await expect(authedPage.getByTestId('nav-workflows')).toBeVisible();
    await expect(authedPage.getByTestId('nav-cases')).toBeVisible();
    await expect(authedPage.getByTestId('nav-settings')).toBeVisible();
  });

  test('navigates to workflows list', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.waitForURL(/\/workflows/);
    // Workflows page should render without error
    await expect(authedPage.locator('body')).not.toContainText(/error|crash/i);
  });

  test('tenant switcher is visible (multi-tenant)', async ({ authedPage }) => {
    await expect(authedPage.getByTestId('tenant-switcher')).toBeVisible();
  });

  test('language switcher is visible (PLANET-927)', async ({ authedPage }) => {
    await expect(authedPage.getByTestId('lang-switcher').first()).toBeVisible();
  });
});
