/**
 * USER STORY: 起步示例 App — 4 组件 + TRIGGER 全流程 (PLANET-1428, +Shopify Connector PLANET-1461)
 *
 * GIVEN 已登录
 * WHEN  选 starter-app 模板
 * THEN  canvas 出现 3 节点 (FRONTEND + BACKEND + FULLSTACK) + 1 TRIGGER 边
 * AND   点 FULLSTACK → 商品 grid 出来
 * AND   点 FRONTEND → 表单展开
 * AND   BACKEND run → 探针 3 步 ✓
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC1: 起步示例 App 全流程', () => {
  test('创建 starter-app → 验证 4 组件 + TRIGGER → 运行全流程', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(180_000);

    const app = new AppPage(page);
    await app.goto();

    // Step 1: 选 starter-app 模板
    await app.createFromStarterTemplate();

    // Step 2: 等 3 个节点出现
    const frontendNode = app.canvas.nodeByType('FRONTEND');
    const backendNode = app.canvas.nodeByType('BACKEND');
    const fullstackNode = app.canvas.nodeByType('FULLSTACK');
    await expect(frontendNode).toBeVisible({ timeout: 15_000 });
    await expect(backendNode).toBeVisible({ timeout: 15_000 });
    await expect(fullstackNode).toBeVisible({ timeout: 15_000 });

    // Step 3: 验证模块列表有 4 项 (PLANET-1461 加了 Shopify Connector)
    await app.openModuleList();
    await expect(page.getByTestId('tab-module-list')).toContainText('(4)', { timeout: 5_000 });

    // Step 4: 点模块列表里的 BACKEND (PLANET-1468: tabs 取代 sticky panel)
    await page.getByTestId('tab-module-list').click();
    const backendRow = page.locator('[data-testid^="module-list-row-"]').filter({ hasText: 'AI 换脸-处理' }).first();
    const backendCompId = (await backendRow.getAttribute('data-testid'))!.replace('module-list-row-', '');
    await backendRow.click({ timeout: 10_000 });
    await page.waitForTimeout(300);
    // Wait for the component tab to actually open (PLANET-1468)
    await expect(page.getByTestId(`tab-component-${backendCompId}`)).toBeVisible({ timeout: 5_000 });
    const componentPanel = page.getByTestId(`component-tab-content-${backendCompId}`);
    await expect(componentPanel).toBeVisible({ timeout: 5_000 });
    await expect(componentPanel.getByTestId(TID.detailSubTabFlow)).toBeVisible({ timeout: 5_000 });
    const runBtn = componentPanel.getByTestId(TID.detailRunBtn);
    await expect(runBtn).toBeVisible({ timeout: 5_000 });
    await runBtn.click();
    await expect(componentPanel.getByTestId(TID.detailProbeStep('uploadOriginal'))).toBeVisible({ timeout: 30_000 });
    await expect(componentPanel.getByTestId(TID.detailProbeStep('callFaceSwapAPI'))).toBeVisible({ timeout: 30_000 });
    await expect(componentPanel.getByTestId(TID.detailProbeStep('saveResult'))).toBeVisible({ timeout: 30_000 });

    // Step 5: 回到 flow graph
    await page.getByTestId(TID.tabFlowGraph).click();

    // Step 6: 开 FULLSTACK tab → run → 验证商品 probes
    await page.getByTestId('tab-module-list').click();
    const fullstackRow = page.locator('[data-testid^="module-list-row-"]').filter({ hasText: 'Shopify 商品列表' }).first();
    const fullstackCompId = (await fullstackRow.getAttribute('data-testid'))!.replace('module-list-row-', '');
    await fullstackRow.click();
    await expect(page.getByTestId(`tab-component-${fullstackCompId}`)).toBeVisible({ timeout: 5_000 });
    const fullstackPanel = page.getByTestId(`component-tab-content-${fullstackCompId}`);
    await expect(fullstackPanel).toBeVisible({ timeout: 5_000 });
    await expect(fullstackPanel.getByTestId(TID.detailSubTabFlow)).toBeVisible({ timeout: 5_000 });
    await fullstackPanel.getByTestId(TID.detailSubTabFlow).click();
    await fullstackPanel.getByTestId(TID.detailRunBtn).click();
    await expect(fullstackPanel.getByTestId(TID.detailProbeStep('callConnector'))).toBeVisible({ timeout: 45_000 });
    await expect(fullstackPanel.getByTestId(TID.detailProbeStep('done'))).toBeVisible({ timeout: 45_000 });

    await fullstackPanel.getByTestId(TID.detailSubTabPreview).click();
    await expect(fullstackPanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });

    // Step 7: 回 flow → 开 FRONTEND → preview tab
    await page.getByTestId(TID.tabFlowGraph).click();
    await page.getByTestId('tab-module-list').click();
    const frontendRow = page.locator('[data-testid^="module-list-row-"]').filter({ hasText: 'AI 换脸-表单' }).first();
    const frontendCompId = (await frontendRow.getAttribute('data-testid'))!.replace('module-list-row-', '');
    await frontendRow.click();
    await expect(page.getByTestId(`tab-component-${frontendCompId}`)).toBeVisible({ timeout: 5_000 });
    const frontendPanel = page.getByTestId(`component-tab-content-${frontendCompId}`);
    await expect(frontendPanel).toBeVisible({ timeout: 5_000 });
    await expect(frontendPanel.getByTestId(TID.detailSubTabPreview)).toBeVisible({ timeout: 5_000 });
    await expect(frontendPanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 15_000 });
  });
});
