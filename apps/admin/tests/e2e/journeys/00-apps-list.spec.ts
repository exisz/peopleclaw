/**
 * USER STORY: Apps 列表页 + AppShell (PLANET-1429, PLANET-1431)
 *
 * GIVEN 已登录
 * WHEN  导航到 /apps
 * THEN  AppShell sidebar 可见 (Apps/Published/Security/Settings, no Home)
 * AND   主区域标题 "Apps" + "+ Create new app" 卡可见
 * WHEN  点击 + Create new app
 * THEN  模板弹窗出现 → 选 starter-app → 跳 /app/:id → canvas 出节点
 */
import { test, expect } from '../fixtures/auth';

test.describe('TC0: Apps 列表页 + AppShell', () => {
  test('/apps 展示 sidebar + Apps 标题 + Create 卡', async ({ authedPage }) => {
    const page = authedPage;

    await page.goto('/apps');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Sidebar visible
    const sidebar = page.locator('[data-testid="apps-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Sidebar nav items — no Home, has Apps/Published/Security/Settings
    await expect(sidebar.getByText('Apps')).toBeVisible();
    await expect(sidebar.getByText('Published')).toBeVisible();
    await expect(sidebar.getByText('Security')).toBeVisible();
    await expect(sidebar.getByText('Settings')).toBeVisible();
    await expect(sidebar.getByText('Home')).not.toBeVisible();

    // Main content
    await expect(page.locator('[data-testid="apps-list-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-new-app-card"]')).toBeVisible();
  });

  test('/app/:id 锁定当前 app, sidebar 隐藏 (PLANET-1442)', async ({ authedPage }) => {
    const page = authedPage;

    // First get an app id
    await page.goto('/apps');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Create an app if needed, or navigate to one
    await page.locator('[data-testid="create-new-app-card"]').click();
    const picker = page.locator('[data-testid="template-picker-overlay"]');
    await expect(picker).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="template-starter-app-btn"]').click();
    await page.waitForURL(/\/app\/[a-zA-Z0-9-]+/, { timeout: 30_000 });

    // PLANET-1442: sidebar hidden in app detail, back link shown
    await expect(page.locator('[data-testid="apps-sidebar"]')).toBeHidden();
    await expect(page.getByTestId('back-to-apps')).toBeVisible({ timeout: 10_000 });
  });

  test('/settings 展示 sidebar', async ({ authedPage }) => {
    const page = authedPage;

    await page.goto('/settings');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const sidebar = page.locator('[data-testid="apps-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Settings should be active in sidebar
    await expect(sidebar.getByText('Settings')).toBeVisible();
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
