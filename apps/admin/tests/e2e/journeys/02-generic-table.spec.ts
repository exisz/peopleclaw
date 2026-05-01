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

    // Step: 点击节点 → 切到 detail panel
    await fullstackNode.click();
    await app.switchToDetail();

    // Step: 点 ▶ Run (通过 detail panel 的 Run 按钮)
    await page.getByTestId(TID.detailRunBtn).click();

    // Step: 等 probe loadRows 出现
    await expect(page.getByTestId(TID.detailProbeStep('loadRows'))).toBeVisible({ timeout: 30_000 });

    // Step: 验证结果 JSON 含 rows (至少 2 行)
    await page.locator('summary:has-text("上次结果")').click();
    const resultJson = app.resultJson();
    await expect(resultJson).toBeVisible({ timeout: 5_000 });
    await expect(resultJson).toContainText('rows');
    const text = await resultJson.textContent();
    expect(text).toMatch(/"rows"\s*:\s*\[/);
    // Verify at least 2 rows in result
    const parsed = JSON.parse(text!);
    expect(parsed.rows.length).toBeGreaterThanOrEqual(2);

    // Step: fullstack preview container visible (compile succeeded)
    const preview = app.fullstackPreview();
    await expect(preview).toBeVisible({ timeout: 30_000 });
  });
});
