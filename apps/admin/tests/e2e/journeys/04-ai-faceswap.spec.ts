/**
 * USER STORY: AI 换脸上传 — 从模板到换脸结果
 * GIVEN 已登录
 * WHEN  点击 + New App → 选 'AI 换脸上传' template
 * THEN  canvas 出现 FULLSTACK 节点
 * AND   点 ▶ Run
 * THEN  探针 uploadOriginal + callFaceSwapAPI + saveResult 全 done
 * AND   结果含 swappedUrl 字段
 *
 * (PLANET-1424)
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC4: AI 换脸上传全流程', () => {
  test('创建换脸 App → 运行 → 验证换脸结果', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(90_000);

    const app = new AppPage(page);
    await app.goto();

    // Step: 选 AI 换脸模板
    await app.createFromTemplate('ai-face-swap-starter');

    // Step: 等 FULLSTACK 节点出现
    const fullstackNode = app.canvas.nodeByType('FULLSTACK');
    await expect(fullstackNode).toBeVisible({ timeout: 15_000 });

    // Step: 点击节点 → 切到 detail panel → Run
    await fullstackNode.click();
    await app.switchToDetail();
    await page.getByRole('button', { name: /Run/ }).click();

    // Step: 等 3 探针 done
    await expect(page.getByTestId(TID.detailProbeStep('uploadOriginal'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(TID.detailProbeStep('callFaceSwapAPI'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(TID.detailProbeStep('saveResult'))).toBeVisible({ timeout: 30_000 });

    // Step: 验证结果 JSON 含 swappedUrl
    await page.locator('summary:has-text("上次结果")').click();
    const resultJson = app.resultJson();
    await expect(resultJson).toBeVisible({ timeout: 5_000 });
    await expect(resultJson).toContainText('swappedUrl');
    await expect(resultJson).toContainText('faceMatched');
  });
});
