/**
 * Nav UX regression: PLANET-1196
 *
 * Verifies:
 * 1. Dashboard has a visible, prominent Cases card entry (nav-cases-card)
 * 2. Clicking the Cases card navigates to /cases
 * 3. /cases page has a back-to-dashboard button (cases-back-dashboard)
 * 4. Clicking it returns to /dashboard
 * 5. Workflows topbar has Cases nav link
 */
import { test, expect } from './fixtures/auth';

test.describe('Nav UX (PLANET-1196)', () => {
  test('dashboard shows prominent Cases card', async ({ authedPage }) => {
    await authedPage.goto('/dashboard');
    await authedPage.waitForLoadState('networkidle');
    // The big cases card should be visible in the main content area
    const casesCard = authedPage.getByTestId('nav-cases-card');
    await expect(casesCard).toBeVisible();
    await authedPage.screenshot({ path: 'test-results/dashboard-cases-card.png' });
  });

  test('cases card navigates to /cases', async ({ authedPage }) => {
    await authedPage.goto('/dashboard');
    await authedPage.waitForLoadState('networkidle');
    await authedPage.getByTestId('nav-cases-card').click();
    await authedPage.waitForURL(/\/cases/);
    await expect(authedPage).toHaveURL(/\/cases/);
    await authedPage.screenshot({ path: 'test-results/cases-page.png' });
  });

  test('/cases page has back-to-dashboard button', async ({ authedPage }) => {
    await authedPage.goto('/cases');
    await authedPage.waitForLoadState('networkidle');
    const backBtn = authedPage.getByTestId('cases-back-dashboard');
    await expect(backBtn).toBeVisible();
    await authedPage.screenshot({ path: 'test-results/cases-back-btn.png' });
  });

  test('back button on /cases returns to /dashboard', async ({ authedPage }) => {
    await authedPage.goto('/cases');
    await authedPage.waitForLoadState('networkidle');
    await authedPage.getByTestId('cases-back-dashboard').click();
    await authedPage.waitForURL(/\/dashboard/);
    await expect(authedPage).toHaveURL(/\/dashboard/);
    await authedPage.screenshot({ path: 'test-results/back-to-dashboard.png' });
  });

  test('workflows topbar has cases nav link', async ({ authedPage }) => {
    await authedPage.goto('/workflows');
    await authedPage.waitForLoadState('networkidle');
    const casesNavLink = authedPage.getByTestId('nav-cases');
    await expect(casesNavLink).toBeVisible();
    await authedPage.screenshot({ path: 'test-results/workflows-nav-cases.png' });
  });
});
