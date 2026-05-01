/**
 * PLANET-1441: Shopify 商品列表 — FULLSTACK preview 真显商品
 *
 * GIVEN 已登录, starter-app 已创建
 * WHEN  点 FULLSTACK → preview tab
 * THEN  等 ≤ 10s 看到至少 1 个商品 card (不是 "无商品数据")
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC6: Shopify 商品列表 prod 显示', () => {
  test('FULLSTACK preview 显示 ≥ 1 商品 card', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(120_000);

    const app = new AppPage(page);
    await app.goto();
    await app.createFromStarterTemplate();

    // Wait for FULLSTACK node
    const fullstackNode = app.canvas.nodeByType('FULLSTACK');
    await expect(fullstackNode).toBeVisible({ timeout: 15_000 });

    // Click FULLSTACK → preview tab
    await fullstackNode.click();
    await expect(page.getByTestId(TID.detailSubTabPreview)).toBeVisible({ timeout: 5_000 });
    await page.getByTestId(TID.detailSubTabPreview).click();

    // Wait for preview to load — expect at least 1 product card (img inside grid)
    const preview = page.getByTestId(TID.detailFullstackPreview);
    // Should NOT show "无商品数据"
    await expect(preview.locator('text=无商品数据')).not.toBeVisible({ timeout: 10_000 });
    // Should show at least 1 product card (div with border containing img + text)
    const productCards = preview.locator('div[style*="border"] img');
    await expect(productCards.first()).toBeVisible({ timeout: 10_000 });

    // Screenshot for verification
    await preview.screenshot({ path: 'test-results/shopify-products.png' });
  });
});
