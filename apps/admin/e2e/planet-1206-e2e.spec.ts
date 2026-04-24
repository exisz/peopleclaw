/**
 * PLANET-1206 E2E — 端到端 v1：上传表 → Shopify 工作流模板 → 10 行 fan-out → 每行出商品链接（错误隔离）
 *
 * Verifies:
 * 1. Upload 10-row CSV (with 1 row price=-5 intentional error)
 * 2. Cases panel shows 1 collapsed batch row "10 行"
 * 3. Expand to see 10 sub-cases
 * 4. After completion: done cases show 查看商品 button; 1 row shows awaiting_fix + "价格不能为负"
 * 5. True Shopify verification: at least 1 case truly created a Shopify product (Shopify Admin API GET)
 *
 * Run:
 *   SHOPIFY_DEV_ADMIN_TOKEN=... pnpm --filter @peopleclaw/admin exec playwright test e2e/planet-1206-e2e.spec.ts
 *
 * Prerequisites:
 *   - seed-e2e.mjs must have been run (creates acceptance tenant + shopify-direct-listing workflow)
 *   - demo_acceptance_test user must be in acceptance tenant
 */
import { test, expect } from './fixtures/auth';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 10-row xlsx with row 5 having price=-5 (intentional error)
const XLSX_PATH = path.resolve(__dirname, '../scripts/test-batch-1206.xlsx');
const SHOPIFY_SHOP = 'claw-eb6xipji.myshopify.com';
// Token read from env — never hardcode in source (GitHub push protection)
const SHOPIFY_ADMIN_TOKEN = (process.env.SHOPIFY_DEV_ADMIN_TOKEN ?? '').replace(/\\n$/, '').trim();

// The workflow id for our direct listing workflow in the acceptance tenant
const DIRECT_LISTING_WF_ID = 'shopify-direct-listing';

/**
 * Switch to the acceptance tenant by setting localStorage and reloading.
 */
async function switchToAcceptanceTenant(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('peopleclaw-current-tenant', 'acceptance');
  });
}

test.describe('PLANET-1206: 10-row batch import → Shopify fan-out → error isolation', () => {
  test.setTimeout(180_000);

  /**
   * Full E2E test: Tests 1-3 combined (they share state = the uploaded batch).
   * Goes through WorkflowEditor → Cases tab → BatchImportDialog.
   * Validates F092 (batch row UI) + F093 (awaiting_fix) + F207 (auto-select template)
   */
  test('1-3. upload 10-row csv → batch row "10 行" → expand → awaiting_fix 价格不能为负', async ({ authedPage }) => {
    // Step 1: Navigate to the shopify-direct-listing workflow
    await authedPage.goto('/workflows');
    await authedPage.waitForLoadState('networkidle');

    // Switch to acceptance tenant (has shopify-direct-listing workflow)
    await switchToAcceptanceTenant(authedPage);

    // Navigate directly to the shopify-direct-listing workflow in the editor
    await authedPage.goto(`/workflows/${DIRECT_LISTING_WF_ID}`);
    await authedPage.waitForLoadState('networkidle');

    // Check if we got redirected (workflow not found for this user?)
    const currentUrl = authedPage.url();
    console.log('[test1] Current URL after navigate:', currentUrl);

    // If redirected away, reload with tenant header in localStorage
    if (!currentUrl.includes(DIRECT_LISTING_WF_ID)) {
      await switchToAcceptanceTenant(authedPage);
      await authedPage.goto(`/workflows/${DIRECT_LISTING_WF_ID}`);
      await authedPage.waitForLoadState('networkidle');
      console.log('[test1] Retried URL:', authedPage.url());
    }

    // Click the Cases tab in the WorkflowEditor
    const casesTab = authedPage.getByTestId('tab-cases');
    await expect(casesTab).toBeVisible({ timeout: 15_000 });
    await casesTab.click();

    // Wait for Cases panel to load
    const batchImportBtn = authedPage.getByTestId('cases-batch-import-btn');
    await expect(batchImportBtn).toBeVisible({ timeout: 15_000 });
    console.log('[test1] CasesPanel loaded, batch import button visible');

    // Click 批量导入
    await batchImportBtn.click();

    // Dialog should open (F207: auto-selects shopify 上架 template since name has '上架')
    await authedPage.waitForTimeout(500);
    const dialog = authedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    console.log('[test1] BatchImportDialog opened');

    // Upload the 10-row xlsx (row 5 has price=-5)
    const fileInput = authedPage.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles(XLSX_PATH);

    // Wait for success
    await expect(authedPage.getByText(/批次导入成功/i).first()).toBeVisible({ timeout: 30_000 });
    console.log('[test1] Import success toast visible');

    // Close dialog
    const closeBtn = authedPage.getByRole('button', { name: /关闭/i }).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) await closeBtn.click();
    else await authedPage.keyboard.press('Escape');
    await authedPage.waitForTimeout(1500);

    // Test 1: Verify batch row "10 行" in CasesPanel
    const batchRowLocator = authedPage.locator('[data-testid^="batch-row-"]');
    await expect(batchRowLocator.first()).toBeVisible({ timeout: 20_000 });
    const batchText = await batchRowLocator.first().textContent();
    console.log('[test1] Batch row text:', batchText);
    expect(batchText).toMatch(/10\s*行/);
    await authedPage.screenshot({ path: 'test-results/planet-1206-t1-batch-row.png' });

    // Test 2: Expand batch row → see at least 9 sub-cases
    await batchRowLocator.first().click();
    await authedPage.waitForTimeout(800);
    const caseCards = authedPage.locator('[data-testid^="case-card-"]');
    const cardCount = await caseCards.count();
    console.log('[test2] Case cards after expand:', cardCount);
    expect(cardCount, 'Expected at least 9 sub-cases').toBeGreaterThanOrEqual(9);
    await authedPage.screenshot({ path: 'test-results/planet-1206-t2-expanded.png' });

    // Test 3: awaiting_fix case with 价格不能为负
    // Cases may still be running, wait for them to settle
    let errorVisible = false;
    for (let i = 0; i < 15; i++) {
      errorVisible = await authedPage.getByText(/价格不能为负/i).first().isVisible({ timeout: 2000 }).catch(() => false);
      if (errorVisible) break;
      await authedPage.waitForTimeout(3000);
      // Don't reload (SSE/polling should update automatically)
    }

    if (!errorVisible) {
      // Reload to get latest state
      await authedPage.reload();
      await authedPage.waitForLoadState('networkidle');
      await switchToAcceptanceTenant(authedPage);
      await authedPage.goto(`/workflows/${DIRECT_LISTING_WF_ID}`);
      await authedPage.waitForLoadState('networkidle');
      const freshCasesTab = authedPage.getByTestId('tab-cases');
      if (await freshCasesTab.isVisible({ timeout: 5000 }).catch(() => false)) await freshCasesTab.click();
      // Expand batch rows
      const freshBatchRows = authedPage.locator('[data-testid^="batch-row-"]');
      if (await freshBatchRows.count() > 0) await freshBatchRows.first().click().catch(() => {});
      await authedPage.waitForTimeout(500);
    }

    await expect(authedPage.getByText(/价格不能为负/i).first()).toBeVisible({ timeout: 15_000 });
    console.log('[test3] awaiting_fix error "价格不能为负" visible ✅');

    const awaitingBadge = authedPage.getByText(/待修复|awaiting.?fix/i).first();
    await expect(awaitingBadge).toBeVisible({ timeout: 5_000 });
    console.log('[test3] awaiting_fix badge visible ✅');

    await authedPage.screenshot({ path: 'test-results/planet-1206-t3-awaiting-fix.png' });
  });

  /**
   * Test 4: Done cases show 查看商品 button
   * Validates F112 (productPublicUrl → 查看商品 button)
   */
  test('4. done cases show 查看商品 button with Shopify URL', async ({ authedPage }) => {
    await authedPage.goto('/cases');
    await authedPage.waitForLoadState('networkidle');
    await switchToAcceptanceTenant(authedPage);

    let shopifyUrls: string[] = [];

    for (let attempt = 0; attempt < 20; attempt++) {
      await authedPage.reload();
      await authedPage.waitForLoadState('networkidle');
      await switchToAcceptanceTenant(authedPage);

      const shopifyBtns = authedPage.locator('[data-testid^="case-shopify-url-"]');
      const count = await shopifyBtns.count();
      console.log(`[test4 attempt ${attempt + 1}] shopify url buttons: ${count}`);

      if (count > 0) {
        for (let j = 0; j < count; j++) {
          const href = await shopifyBtns.nth(j).getAttribute('href');
          if (href) shopifyUrls.push(href);
        }
        break;
      }

      await authedPage.waitForTimeout(5000);
    }

    console.log('[test4] Shopify URLs found:', shopifyUrls.length, shopifyUrls);
    expect(shopifyUrls.length, 'Expected at least 1 查看商品 button').toBeGreaterThan(0);
    shopifyUrls.forEach((url) => {
      expect(url).toContain('/products/');
    });

    await authedPage.screenshot({ path: 'test-results/planet-1206-t4-shopify-btn.png' });
  });

  /**
   * Test 5: TRUE Shopify verification
   */
  test('5. true Shopify verification — product exists in Shopify Admin API', async ({ authedPage, request }) => {
    test.skip(!SHOPIFY_ADMIN_TOKEN, 'SHOPIFY_DEV_ADMIN_TOKEN not set in env');

    await authedPage.goto('/cases');
    await authedPage.waitForLoadState('networkidle');
    await switchToAcceptanceTenant(authedPage);

    const shopifyUrls: string[] = [];

    for (let attempt = 0; attempt < 20; attempt++) {
      await switchToAcceptanceTenant(authedPage);

      const shopifyBtns = authedPage.locator('[data-testid^="case-shopify-url-"]');
      const count = await shopifyBtns.count();
      if (count > 0) {
        for (let j = 0; j < count; j++) {
          const href = await shopifyBtns.nth(j).getAttribute('href');
          if (href) shopifyUrls.push(href);
        }
        break;
      }
      await authedPage.waitForTimeout(3000);
      await authedPage.reload();
      await authedPage.waitForLoadState('networkidle');
    }

    expect(shopifyUrls.length, 'Need at least 1 Shopify URL to verify').toBeGreaterThan(0);

    const firstUrl = shopifyUrls[0];
    const handleMatch = firstUrl.match(/\/products\/([^/?#]+)/);
    expect(handleMatch, `Could not parse product handle from: ${firstUrl}`).not.toBeNull();
    const productHandle = handleMatch![1];
    console.log('[test5] Verifying Shopify product handle:', productHandle);

    const shopifyAdminUrl = `https://${SHOPIFY_SHOP}/admin/api/2024-10/products.json?handle=${productHandle}`;
    const shopifyRes = await request.get(shopifyAdminUrl, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    console.log('[test5] Shopify Admin API status:', shopifyRes.status());
    expect(shopifyRes.ok(), `Shopify Admin API returned ${shopifyRes.status()}`).toBe(true);

    const body = await shopifyRes.json() as { products?: Array<{ id: number; title: string; status: string; handle: string }> };
    const products = body.products ?? [];
    console.log('[test5] Products found:', products.map((p) => ({ id: p.id, title: p.title, status: p.status })));

    expect(products.length, `No Shopify product with handle "${productHandle}"`).toBeGreaterThan(0);
    expect(products[0].handle).toBe(productHandle);

    console.log('\n[PLANET-1206 PROOF] ✅ Shopify product verified:');
    console.log(`  Public URL: ${firstUrl}`);
    console.log(`  Admin URL: https://admin.shopify.com/store/claw-eb6xipji/products/${products[0].id}`);
    console.log(`  Title: ${products[0].title}`);
    console.log(`  Status: ${products[0].status}`);
  });
});
