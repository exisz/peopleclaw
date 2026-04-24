/**
 * Nav UX regression: PLANET-1196 (round 3)
 *
 * Verifies:
 * 1. Dashboard has a visible, prominent Cases card entry (nav-cases-card)
 * 2. Clicking the Cases card navigates to /cases
 * 3. /cases page has a back-to-home (workflows) button (cases-back-home)
 * 4. Clicking it returns to /workflows (NOT /dashboard)
 * 5. Workflows topbar has Cases nav link
 * 6. 「批量导入」with no workflows shows actionable toast (not dead "暂无可用")
 */
import { test, expect } from './fixtures/auth';

test.describe('Nav UX (PLANET-1196 r3)', () => {
  test('dashboard shows prominent Cases card', async ({ authedPage }) => {
    await authedPage.goto('/dashboard');
    await authedPage.waitForLoadState('networkidle');
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

  test('/cases page has back-to-home (workflows) button', async ({ authedPage }) => {
    await authedPage.goto('/cases');
    await authedPage.waitForLoadState('networkidle');
    // Round 3: button is now cases-back-home pointing to /workflows
    const backBtn = authedPage.getByTestId('cases-back-home');
    await expect(backBtn).toBeVisible();
    await authedPage.screenshot({ path: 'test-results/cases-back-btn.png' });
  });

  test('← 主页 button on /cases navigates to /workflows (not /dashboard)', async ({ authedPage }) => {
    await authedPage.goto('/cases');
    await authedPage.waitForLoadState('networkidle');
    await authedPage.getByTestId('cases-back-home').click();
    await authedPage.waitForURL(/\/workflows/);
    await expect(authedPage).toHaveURL(/\/workflows/);
    await authedPage.screenshot({ path: 'test-results/back-to-workflows.png' });
  });

  test('workflows topbar has cases nav link', async ({ authedPage }) => {
    await authedPage.goto('/workflows');
    await authedPage.waitForLoadState('networkidle');
    const casesNavLink = authedPage.getByTestId('nav-cases');
    await expect(casesNavLink).toBeVisible();
    await authedPage.screenshot({ path: 'test-results/workflows-nav-cases.png' });
  });

  test('批量导入 with no workflows shows actionable toast (not dead empty)', async ({ authedPage }) => {
    // Navigate to /cases
    await authedPage.goto('/cases');
    await authedPage.waitForLoadState('networkidle');

    // Click 批量导入
    const importBtn = authedPage.getByTestId('cases-batch-import-btn');
    await expect(importBtn).toBeVisible();
    await importBtn.click();

    // Should either:
    // A. Show a toast with an action button to create workflow (when no workflows available)
    // B. Open a dialog (when workflows ARE available)
    // We need to detect which scenario and assert accordingly.

    // Wait briefly for reaction
    await authedPage.waitForTimeout(1500);

    // Check for dialog OR actionable toast — either is a pass (as long as nothing is silently broken)
    const dialog = authedPage.locator('[role="dialog"]');
    const toastActionBtn = authedPage.locator('[data-sonner-toast] button').filter({ hasText: /工作流|workflow/i });
    const anyToast = authedPage.locator('[data-sonner-toast]');

    const dialogVisible = await dialog.isVisible().catch(() => false);
    const toastVisible = await anyToast.isVisible().catch(() => false);

    // Must have SOMETHING happen (dialog OR toast)
    expect(dialogVisible || toastVisible).toBe(true);

    // If toast appeared without dialog: must NOT be a dead "暂无可用" with no action
    if (toastVisible && !dialogVisible) {
      // The toast should contain a navigate action (去创建工作流) not just static text
      await expect(toastActionBtn.first()).toBeVisible({ timeout: 5000 });
    }

    await authedPage.screenshot({ path: 'test-results/batch-import-click.png' });
  });
});
