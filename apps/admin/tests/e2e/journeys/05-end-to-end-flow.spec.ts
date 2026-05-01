/**
 * PLANET-1440: 端到端真闭环 — FRONTEND submit → BACKEND run → result rendered
 *
 * GIVEN 已登录, starter-app 已创建
 * WHEN  点 FRONTEND → preview → 上传图 → 提交
 * THEN  等 ≤ 10s 看到 swappedUrl img (data-testid="face-swap-result")
 * AND   0 console errors / 4xx-5xx
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';
import path from 'node:path';

test.describe('TC5: FRONTEND → BACKEND 端到端闭环', () => {
  test('上传图 → 提交 → 看到 swapped 结果', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(120_000);

    // Collect console errors and failed requests
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('requestfailed', req => errors.push(`Request failed: ${req.url()}`));
    page.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('/connections')) {
        errors.push(`${res.status()} ${res.url()}`);
      }
    });

    const app = new AppPage(page);
    await app.goto();
    await app.createFromStarterTemplate();

    // Wait for FRONTEND node
    const frontendNode = app.canvas.nodeByType('FRONTEND');
    await expect(frontendNode).toBeVisible({ timeout: 15_000 });

    // Click FRONTEND → preview tab
    await frontendNode.click();
    await expect(page.getByTestId(TID.detailSubTabPreview)).toBeVisible({ timeout: 5_000 });
    await page.getByTestId(TID.detailSubTabPreview).click();

    // Wait for preview to load
    const preview = page.getByTestId(TID.detailFullstackPreview);
    await expect(preview.locator('form')).toBeVisible({ timeout: 10_000 });

    // Upload a small test image via setInputFiles
    const testImagePath = path.resolve(__dirname, '../fixtures/test-image.png');
    const fileInput = preview.locator('[data-testid="face-swap-file-input"]');
    await fileInput.setInputFiles(testImagePath);

    // Click submit
    const submitBtn = preview.locator('[data-testid="face-swap-submit-btn"]');
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 });
    await submitBtn.click();

    // Wait for result image to appear (not "已提交" or "处理中")
    const resultImg = preview.locator('[data-testid="face-swap-result"]');
    await expect(resultImg).toBeVisible({ timeout: 10_000 });

    // Verify no critical errors (allow some network noise)
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('connections'));
    expect(criticalErrors).toHaveLength(0);
  });
});
