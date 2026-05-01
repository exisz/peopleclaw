/**
 * TC1: 电商预制 App — 3 节点真跑通 (PLANET-1423)
 *
 * Steps:
 * 1. Login (via auth fixture)
 * 2. Navigate to /app
 * 3. Click 🛒 电商起步 template button
 * 4. Wait for canvas nodes with run buttons
 * 5. Find BACKEND node (Shopify), click Run
 * 6. Wait for done status (30s)
 * 7. Verify probe steps appear
 * 8. Verify result JSON contains "products"
 * 9. Find FULLSTACK node, click Run
 * 10. Wait for fullstack preview with product content
 * 11. Verify module-list-status shows done
 */
import { test, expect } from './fixtures/auth';

test.describe('TC1: 电商预制 App 全流程', () => {
  test('创建电商 App → 运行 Backend → 运行 Fullstack → 验证结果', async ({ authedPage }) => {
    const page = authedPage;

    // Navigate to /app
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Click 电商起步 template
    await page.getByTestId('template-ecommerce-btn').click();

    // Wait for run buttons to appear (BACKEND + FULLSTACK = 2 run buttons)
    const runButtons = page.locator('[data-testid$="-run-btn"]');
    await expect(runButtons.first()).toBeVisible({ timeout: 15_000 });

    // Find BACKEND node by locating the node containing "BACKEND" text
    const backendNode = page.locator('[data-testid^="canvas-node-"]:not([data-testid*="-run-btn"]):not([data-testid*="-status-"])').filter({ hasText: 'BACKEND' }).first();
    await expect(backendNode).toBeVisible({ timeout: 5_000 });

    // Get its component ID from data-testid
    const backendTestId = await backendNode.getAttribute('data-testid');
    const backendId = backendTestId!.replace('canvas-node-', '');

    // Click Run on backend node
    await page.getByTestId(`canvas-node-${backendId}-run-btn`).click();

    // Wait for status done (30s timeout)
    await expect(page.getByTestId(`canvas-node-${backendId}-status-done`)).toBeVisible({ timeout: 30_000 });

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
    const fullstackNode = page.locator('[data-testid^="canvas-node-"]:not([data-testid*="-run-btn"]):not([data-testid*="-status-"])').filter({ hasText: 'FULLSTACK' }).first();
    await expect(fullstackNode).toBeVisible();
    const fullstackTestId = await fullstackNode.getAttribute('data-testid');
    const fullstackId = fullstackTestId!.replace('canvas-node-', '');

    // Click Run on fullstack node
    await page.getByTestId(`canvas-node-${fullstackId}-run-btn`).click();

    // Wait for done
    await expect(page.getByTestId(`canvas-node-${fullstackId}-status-done`)).toBeVisible({ timeout: 30_000 });

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
