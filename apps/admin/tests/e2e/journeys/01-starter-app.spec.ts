/**
 * USER STORY: 起步示例 App — 3 组件 + TRIGGER 全流程 (PLANET-1428)
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
  test('创建 starter-app → 验证 3 组件 + TRIGGER → 运行全流程', async ({ authedPage }) => {
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

    // Step 3: 验证模块列表有 3 项
    await app.openModuleList();
    await expect(page.locator('text=模块列表 (3)')).toBeVisible({ timeout: 5_000 });

    // Step 4: 点 BACKEND → 进入 detail (default flow tab) → Run → 验证探针
    await backendNode.click();
    // Should auto-switch to detail tab with flow sub-tab
    await expect(page.getByTestId(TID.detailSubTabFlow)).toBeVisible({ timeout: 5_000 });
    // Run backend
    await page.getByTestId(TID.detailRunBtn).click();
    // 验证 3 步探针
    await expect(page.getByTestId(TID.detailProbeStep('uploadOriginal'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(TID.detailProbeStep('callFaceSwapAPI'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(TID.detailProbeStep('saveResult'))).toBeVisible({ timeout: 30_000 });

    // Step 5: 回到 flow graph → 验证 BACKEND status done
    await page.getByTestId(TID.tabFlowGraph).click();
    const backendId = await app.canvas.getNodeId(backendNode);
    await app.canvas.waitStatus(backendId, 'done', 45_000);

    // Step 6: 点 FULLSTACK → run → 验证商品 probes
    await fullstackNode.click();
    await expect(page.getByTestId(TID.detailSubTabFlow)).toBeVisible({ timeout: 5_000 });
    await page.getByTestId(TID.detailRunBtn).click();
    await expect(page.getByTestId(TID.detailProbeStep('fetchProducts'))).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId(TID.detailProbeStep('done'))).toBeVisible({ timeout: 45_000 });

    // Switch to preview tab — container visible
    await page.getByTestId(TID.detailSubTabPreview).click();
    const preview = app.fullstackPreview();
    await expect(preview).toBeVisible({ timeout: 30_000 });

    // Step 7: 回到 flow graph → 点 FRONTEND → preview tab
    await page.getByTestId(TID.tabFlowGraph).click();
    await frontendNode.click();
    // FRONTEND defaults to preview tab
    await expect(page.getByTestId(TID.detailSubTabPreview)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 15_000 });
  });
});
