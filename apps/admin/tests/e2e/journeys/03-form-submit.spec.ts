/**
 * USER STORY: 表单 Starter — 填表单 → 触发后端提交 → 验证结果
 * GIVEN 已登录
 * WHEN  点击 + New App → 选 '表单 Starter' template
 * THEN  canvas 出现 FRONTEND + BACKEND 节点
 * AND   点 BACKEND 节点 ▶ Run (模拟提交)
 * THEN  探针 validate + save 出现
 * AND   结果含 ok: true + savedId
 *
 * (PLANET-1424)
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC3: 表单提交全流程', () => {
  test('创建表单 App → 运行 Backend → 验证提交结果', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(90_000);

    const app = new AppPage(page);
    await app.goto();

    // Step: 选表单 starter 模板
    await app.createFromTemplate('form-starter');

    // Step: 等 2 节点出现 (FRONTEND + BACKEND)
    const frontendNode = app.canvas.nodeByType('FRONTEND');
    await expect(frontendNode).toBeVisible({ timeout: 15_000 });
    const backendNode = app.canvas.nodeByType('BACKEND');
    await expect(backendNode).toBeVisible({ timeout: 15_000 });

    // Step: 点 BACKEND 节点 → 切到 detail panel → Run
    await backendNode.click();
    await app.switchToDetail();
    await page.getByRole('button', { name: /Run/ }).click();

    // Step: 等 probe validate + save 出现
    await expect(page.getByTestId(TID.detailProbeStep('validate'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(TID.detailProbeStep('save'))).toBeVisible({ timeout: 30_000 });

    // Step: 验证结果 JSON 含 ok + savedId
    await page.locator('summary:has-text("上次结果")').click();
    const resultJson = app.resultJson();
    await expect(resultJson).toBeVisible({ timeout: 5_000 });
    await expect(resultJson).toContainText('ok');
    await expect(resultJson).toContainText('savedId');
  });
});
