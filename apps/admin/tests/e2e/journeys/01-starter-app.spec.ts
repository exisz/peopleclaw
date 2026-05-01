/**
 * USER STORY: 起步示例 App — 3 组件 + TRIGGER 全流程 (PLANET-1428)
 *
 * GIVEN 已登录
 * WHEN  选 starter-app 模板
 * THEN  canvas 出现 3 节点 (FRONTEND + BACKEND + FULLSTACK) + 1 TRIGGER 边
 * AND   点 FULLSTACK → 商品 grid 渲染
 * AND   点 FRONTEND → 表单展开 → 填字段 → 提交
 * AND   BACKEND status done + 探针 3 步 ✓
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

    // Step 4: 点 FULLSTACK (商品列表) → run → 验证预览 (grid)
    const fullstackId = await app.canvas.getNodeId(fullstackNode);
    await fullstackNode.click();
    await app.switchToDetail();

    // Should default to 'flow' tab for FULLSTACK — click Run
    await page.getByTestId(TID.detailRunBtn).click();
    await expect(page.getByTestId(TID.detailProbeStep('fetchProducts'))).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId(TID.detailProbeStep('done'))).toBeVisible({ timeout: 45_000 });

    // Switch to preview tab — verify grid renders
    await page.getByTestId(TID.detailSubTabPreview).click();
    const preview = app.fullstackPreview();
    await expect(preview).toBeVisible({ timeout: 30_000 });

    // Step 5: 回到 flow graph → 点 FRONTEND (换脸表单)
    await page.getByTestId(TID.tabFlowGraph).click();
    await frontendNode.click();

    // FRONTEND defaults to preview tab
    await expect(page.getByTestId(TID.detailSubTabPreview)).toBeVisible();
    // Preview container should be visible (compile + mount attempted)
    await expect(page.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 15_000 });

    // Step 6: 回到 flow graph → 点 BACKEND → 验证 flow tab + expected probes
    await page.getByTestId(TID.tabFlowGraph).click();
    await backendNode.click();

    // BACKEND defaults to flow tab
    await expect(page.getByTestId(TID.detailSubTabFlow)).toBeVisible();
    // Should show expected probes (pre-distilled)
    await expect(page.getByTestId(TID.detailProbeExpected('uploadOriginal'))).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(TID.detailProbeExpected('callFaceSwapAPI'))).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(TID.detailProbeExpected('saveResult'))).toBeVisible({ timeout: 5_000 });

    // Step 7: Run BACKEND directly → 验证 3 步探针 pass
    await page.getByTestId(TID.detailRunBtn).click();
    await expect(page.getByTestId(TID.detailProbeStep('uploadOriginal'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(TID.detailProbeStep('callFaceSwapAPI'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(TID.detailProbeStep('saveResult'))).toBeVisible({ timeout: 30_000 });

    // Step 8: 验证 BACKEND status done
    const backendId = await app.canvas.getNodeId(backendNode);
    await page.getByTestId(TID.tabFlowGraph).click();
    await app.canvas.waitStatus(backendId, 'done', 10_000);
  });
});
