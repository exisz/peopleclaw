/**
 * USER STORY: Apps 列表页 + Sidebar (PLANET-1429)
 *
 * GIVEN 已登录
 * WHEN  导航到 /apps
 * THEN  左侧 sidebar 可见 (Home/Apps/Published/Security/Settings)
 * AND   主区域标题 "Apps" + "+ Create new app" 卡可见
 * WHEN  点击 + Create new app
 * THEN  模板弹窗出现 → 选 starter-app → 跳 /app/:id → canvas 出节点
 */
import { test, expect } from '../fixtures/auth';

test.describe('TC0: Apps 列表页', () => {
  test('/apps 展示 sidebar + Apps 标题 + Create 卡', async ({ authedPage }) => {
    const page = authedPage;

    await page.goto('/apps');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Sidebar visible
    const sidebar = page.locator('[data-testid="apps-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Sidebar nav items
    await expect(sidebar.getByText('Home')).toBeVisible();
    await expect(sidebar.getByText('Apps')).toBeVisible();

    // Main content
    await expect(page.locator('[data-testid="apps-list-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-new-app-card"]')).toBeVisible();
  });

  test('点击 + Create → 模板弹窗 → 选 starter-app → 跳 /app/:id', async ({ authedPage }) => {
    const page = authedPage;

    await page.goto('/apps');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Click create card
    await page.locator('[data-testid="create-new-app-card"]').click();

    // Template picker appears
    const picker = page.locator('[data-testid="template-picker-overlay"]');
    await expect(picker).toBeVisible({ timeout: 5_000 });

    // Select starter-app template
    await page.locator('[data-testid="template-starter-app-btn"]').click();

    // Should navigate to /app/:id
    await page.waitForURL(/\/app\/[a-zA-Z0-9-]+/, { timeout: 30_000 });

    // Canvas should show nodes
    const canvas = page.locator('[data-testid="canvas-pane"]');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
  });
});
