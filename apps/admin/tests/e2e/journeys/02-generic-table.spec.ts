/**
 * USER STORY: 通用表格 — 从模板创建到看到表格数据
 * GIVEN 已登录
 * WHEN  点击 + New App → 选 '通用表格' template
 * THEN  canvas 出现 FULLSTACK 节点
 * AND   点 ▶ Run
 * THEN  探针 loadRows 出现
 * AND   fullstack preview 渲染 <table> 含至少 2 行数据
 *
 * (PLANET-1424)
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC2: 通用表格全流程', () => {
  test('创建表格 App → 运行 → 验证表格数据', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(90_000);

    const app = new AppPage(page);
    await app.goto();

    // Step: 选通用表格模板
    await app.createFromTemplate('generic-table');

    // Step: 等 FULLSTACK 节点出现
    const fullstackNode = app.canvas.nodeByType('FULLSTACK');
    await expect(fullstackNode).toBeVisible({ timeout: 15_000 });
    const nodeId = await app.canvas.getNodeId(fullstackNode);

    // Step: 点 ▶ Run
    await app.canvas.runNode(nodeId);

    // Step: 点击节点 → 切到 detail panel
    await fullstackNode.click();
    await app.switchToDetail();

    // Step: 等 probe loadRows 出现
    await expect(page.getByTestId(TID.detailProbeStep('loadRows'))).toBeVisible({ timeout: 30_000 });

    // Step: 验证结果 JSON 含 rows
    await page.locator('summary:has-text("上次结果")').click();
    const resultJson = app.resultJson();
    await expect(resultJson).toBeVisible({ timeout: 5_000 });
    await expect(resultJson).toContainText('rows');

    // Step: 加载 fullstack preview → 验证 table 存在
    const preview = app.fullstackPreview();
    await expect(preview).toBeVisible({ timeout: 30_000 });
    // Preview should eventually render table content
    await expect(preview.locator('table')).toBeVisible({ timeout: 15_000 });
    // At least 2 data rows (tr in tbody)
    const rowCount = await preview.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });
});
