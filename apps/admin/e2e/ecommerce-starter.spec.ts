/**
 * TC1: 电商预制 App — 3 节点真跑通 (PLANET-1423)
 */
import { test, expect } from './fixtures/auth';

test.describe('TC1: 电商预制 App 全流程', () => {
  test('创建电商 App → 运行 Backend → 运行 Fullstack → 验证结果', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(120_000); // extend timeout for real API calls

    // Navigate to /app
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Click 电商起步 template
    await page.getByTestId('template-ecommerce-btn').click();

    // Wait for BACKEND node's run button to be visible
    // Find BACKEND node
    const allNodes = page.locator('[data-testid^="canvas-node-"]:not([data-testid*="-run-btn"]):not([data-testid*="-status-"])');
    const backendNode = allNodes.filter({ hasText: 'BACKEND' }).first();
    await expect(backendNode).toBeVisible({ timeout: 15_000 });

    const backendTestId = await backendNode.getAttribute('data-testid');
    const backendId = backendTestId!.replace('canvas-node-', '');

    // Verify run button exists and click it
    const runBtn = page.getByTestId(`canvas-node-${backendId}-run-btn`);
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // Wait for status to NOT be idle anymore (running/done/error)
    // The status element data-testid changes dynamically, so wait for idle to disappear
    await expect(page.getByTestId(`canvas-node-${backendId}-status-idle`)).not.toBeAttached({ timeout: 10_000 });

    // Now wait for done (with extended timeout for real Shopify API call)
    await expect(page.getByTestId(`canvas-node-${backendId}-status-done`)).toBeVisible({ timeout: 45_000 });

    // Click the node to open detail panel
    await backendNode.click();

    // Wait for probe steps
    await expect(page.getByTestId('detail-probe-step-loadConnection')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('detail-probe-step-fetchProducts')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('detail-probe-step-done')).toBeVisible({ timeout: 10_000 });

    // Verify result JSON contains "products"
    await page.locator('summary:has-text("上次结果")').click();
    const resultJson = page.getByTestId('detail-result-json');
    await expect(resultJson).toBeVisible();
    await expect(resultJson).toContainText('products');
    const resultText = await resultJson.textContent();
    expect(resultText).toMatch(/"products"\s*:\s*\[/);

    // Now find FULLSTACK node
    const fullstackNode = allNodes.filter({ hasText: 'FULLSTACK' }).first();
    await expect(fullstackNode).toBeVisible();
    const fullstackTestId = await fullstackNode.getAttribute('data-testid');
    const fullstackId = fullstackTestId!.replace('canvas-node-', '');

    // Click Run on fullstack node
    await page.getByTestId(`canvas-node-${fullstackId}-run-btn`).click();

    // Wait for done
    await expect(page.getByTestId(`canvas-node-${fullstackId}-status-done`)).toBeVisible({ timeout: 45_000 });

    // Click fullstack node to see detail
    await fullstackNode.click();

    // Wait for fullstack preview to render with product content
    const preview = page.getByTestId('detail-fullstack-preview');
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await expect(preview).not.toBeEmpty();

    // Open module list drawer and verify status
    await page.getByTestId('module-list-drawer-toggle').click();
    await expect(page.getByTestId(`module-list-status-${backendId}`)).toContainText('done');
    await expect(page.getByTestId(`module-list-status-${fullstackId}`)).toContainText('done');
  });
});
