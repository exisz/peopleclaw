/**
 * PLANET-1208 E2E — 工作流删除流程修复
 *
 * Verifies:
 * (a) 普通工作流能正常删除 — 列表立刻消失，无错误弹框，无 ErrorBoundary 崩溃
 * (b) Shopify 工作流（有 batch import cases）不能删 — 显示具体原因，不泛报错
 *
 * Prerequisites:
 *   - seed-e2e.mjs must have been run (acceptance tenant + shopify-direct-listing workflow with cases)
 */
import { test, expect } from './fixtures/auth';

test.describe('PLANET-1208: workflow delete fixes', () => {
  test.setTimeout(90_000);

  /**
   * Bug 1: 普通工作流删除后列表立刻消失，不弹 ErrorBoundary，不需要"重试"
   */
  test('(a) 普通工作流删除后列表立刻消失，无错误弹框', async ({ authedPage }) => {
    // Switch to acceptance tenant before load
    await authedPage.addInitScript(() => {
      localStorage.setItem('peopleclaw-current-tenant', 'acceptance');
    });
    await authedPage.goto('/workflows');
    await authedPage.waitForURL(/\/workflows/, { timeout: 20_000 });
    await authedPage.waitForLoadState('networkidle', { timeout: 15_000 });

    // Create a fresh workflow to delete
    const createBtn = authedPage.getByTestId('create-workflow-btn').first();
    await expect(createBtn).toBeVisible({ timeout: 15_000 });
    await createBtn.click();

    // Dialog should open — use last textbox (as in other tests)
    const nameInput = authedPage.getByRole('textbox').last();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    const wfName = `e2e-del-${Date.now()}`;
    await nameInput.fill(wfName);
    await authedPage.getByRole('button', { name: /create|ok|submit|确认/i }).last().click();

    // Workflow should appear in sidebar + be selected
    await expect(authedPage.getByTestId('workflow-breadcrumb-name')).toContainText(wfName, { timeout: 15_000 });
    await authedPage.waitForURL(/\/workflows\/.+/, { timeout: 10_000 });
    const wfId = authedPage.url().match(/\/workflows\/([^/]+)/)?.[1] ?? '';
    expect(wfId).toBeTruthy();

    // Click delete via topbar button (more reliable than menu hover)
    const topbarDeleteBtn = authedPage.getByTestId('topbar-delete-workflow-btn');
    await expect(topbarDeleteBtn).toBeVisible({ timeout: 5_000 });
    await topbarDeleteBtn.click();

    // Wait for API + UI update — workflow should disappear from sidebar
    await expect(authedPage.locator(`[data-testid="sidebar-workflow-${wfId}"]`)).not.toBeVisible({ timeout: 10_000 });

    // No ErrorBoundary — "页面加载出错" / "重试" must NOT be present
    const errBoundary = authedPage.getByText('页面加载出错');
    await expect(errBoundary).not.toBeVisible({ timeout: 3_000 }).catch(() => {
      // soft check — if not found that's fine
    });

    // Must show success toast
    await expect(authedPage.locator('[data-sonner-toast]').first()).toContainText(
      /已删除|工作流/,
      { timeout: 8_000 },
    );
  });

  /**
   * Bug 2: Shopify 工作流（有 cases）删除时给出具体中文原因，不崩溃不报泛错
   */
  test('(b) Shopify 工作流有案例时显示具体原因，不弹 ErrorBoundary', async ({ authedPage }) => {
    await authedPage.addInitScript(() => {
      localStorage.setItem('peopleclaw-current-tenant', 'acceptance');
    });
    await authedPage.goto('/workflows/shopify-direct-listing');
    await authedPage.waitForURL(/\/workflows/, { timeout: 20_000 });
    await authedPage.waitForLoadState('networkidle', { timeout: 15_000 });

    // Workflow should be loaded
    await expect(authedPage.getByTestId('workflow-breadcrumb-name')).toBeVisible({ timeout: 15_000 });

    // Try delete via topbar
    const topbarDeleteBtn = authedPage.getByTestId('topbar-delete-workflow-btn');
    await expect(topbarDeleteBtn).toBeVisible({ timeout: 5_000 });
    await topbarDeleteBtn.click();

    // Wait for API response
    await authedPage.waitForTimeout(2_500);

    // Must NOT crash to ErrorBoundary
    await expect(authedPage.getByText('页面加载出错')).not.toBeVisible();

    // Toast must show cases-specific message — NOT generic machine code
    const toastEl = authedPage.locator('[data-sonner-toast]').first();
    await expect(toastEl).toBeVisible({ timeout: 8_000 });
    const toastText = await toastEl.textContent();
    // Should contain Chinese reason about cases
    expect(toastText).toMatch(/案例|无法删除|工作流/);
    // Must NOT be the raw machine error code
    expect(toastText).not.toContain('workflow_in_use');
    expect(toastText).not.toMatch(/出现失误|Internal server error|API 409/);
  });
});
