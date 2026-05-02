/**
 * PLANET-1464: Shopify 商品列表 — prod 回归锁定
 *
 * 陛下在 prod 看到「🛍️ Shopify 商品列表 / 无商品数据」。
 * 这不应该发生，因为 PLANET-1441 fixed Shopify creds 从 Connection 表读 +
 * 12h cron 自动 refresh shopify token。
 *
 * GIVEN 已登录 (e2e mint), 创建 starter-app
 * WHEN  在画布上找到 FULLSTACK + name 含「Shopify 商品列表」的组件，进入 preview
 * THEN  preview 区域含 ≥1 个商品 card，且不含「无商品数据」
 *
 * 失败时打印诊断:
 *   - tenant 的 shopify Connection.config (admin_token 是否在)
 *   - 该组件 server 代码 inline (用于排查)
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.peopleclaw.rollersoft.com.au';

test.describe('TC6.1 (PLANET-1464): Shopify 商品列表 不能是空状态', () => {
  test('FULLSTACK 「Shopify 商品列表」 preview 显示 ≥ 1 商品 (不是「无商品数据」)', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(180_000);

    // ---- collect diagnostics ----
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
    });
    page.on('response', async (res) => {
      if (res.status() >= 400 && res.url().includes('/api/')) {
        let body = '';
        try { body = (await res.text()).slice(0, 300); } catch {}
        failedRequests.push(`HTTP ${res.status()} ${res.url()} :: ${body}`);
      }
    });

    const app = new AppPage(page);
    await app.goto();

    // Create from starter template (name: 「起步示例 App」, id: starter-app)
    await app.createFromStarterTemplate();

    // Find the FULLSTACK node — starter-app has exactly one FULLSTACK component
    // named 「Shopify 商品列表」. Match by type to be robust.
    const fullstackNode = app.canvas.nodeByType('FULLSTACK');
    await expect(fullstackNode, 'FULLSTACK node should be on the canvas').toBeVisible({ timeout: 20_000 });

    // Sanity check: node text contains the Chinese name
    const nodeText = await fullstackNode.innerText().catch(() => '');
    expect(nodeText, `FULLSTACK node text should mention 「Shopify 商品列表」 (was: ${nodeText})`)
      .toMatch(/Shopify\s*商品列表/);

    // Click node → preview tab
    await fullstackNode.click();
    await expect(page.getByTestId(TID.detailSubTabPreview)).toBeVisible({ timeout: 8_000 });
    await page.getByTestId(TID.detailSubTabPreview).click();

    const preview = page.getByTestId(TID.detailFullstackPreview);
    await expect(preview, 'fullstack preview container should mount').toBeVisible({ timeout: 10_000 });

    // Wait until either products render OR empty-state appears (whichever first)
    // so we can assert deterministically.
    await page.waitForFunction(
      () => {
        const root = document.querySelector('[data-testid="detail-fullstack-preview"]');
        if (!root) return false;
        const text = root.textContent || '';
        const hasEmpty = text.includes('无商品数据');
        const hasImg = !!root.querySelector('img');
        return hasEmpty || hasImg;
      },
      { timeout: 30_000 },
    ).catch(() => { /* fall through to assertions */ });

    // ---- snapshot for visual proof ----
    await preview.screenshot({ path: 'test-results/planet-1464-shopify-products.png' }).catch(() => {});

    // ---- pull diagnostics on failure ----
    const dumpDiagnostics = async (label: string) => {
      console.error(`\n========== PLANET-1464 DIAGNOSTICS: ${label} ==========`);
      console.error(`BASE_URL: ${BASE_URL}`);

      // 1. preview HTML snippet
      const html = await preview.innerHTML().catch(() => '<<could not read>>');
      console.error('PREVIEW HTML (first 1500 chars):');
      console.error(html.slice(0, 1500));

      // 2. probe events from detail panel (if visible)
      const probeSteps = await app.canvas.getProbeSteps().catch(() => []);
      console.error(`PROBE STEPS visible in panel: ${JSON.stringify(probeSteps)}`);

      // 3. tenant connections (mask leaks ok — we only need to know admin_token existence)
      try {
        const connsResp = await page.evaluate(async () => {
          // Find current tenant slug from URL or window state
          // Fallback: hit /api/me to discover tenant
          const meRes = await fetch('/api/me', { credentials: 'include' });
          const me = await meRes.json().catch(() => ({}));
          const slug = me?.user?.tenants?.[0]?.slug || me?.tenants?.[0]?.slug || me?.activeTenant?.slug;
          if (!slug) return { error: 'no tenant slug found', me };
          const r = await fetch(`/api/tenants/${slug}/connections`, { credentials: 'include' });
          const j = await r.json().catch(() => ({}));
          return { slug, status: r.status, body: j };
        });
        console.error('TENANT CONNECTIONS:');
        console.error(JSON.stringify(connsResp, null, 2));

        // Specifically: is shopify Connection present + admin_token populated?
        const conns = (connsResp as any)?.body?.connections || [];
        const shopify = conns.find((c: any) => c.type === 'shopify');
        if (!shopify) {
          console.error('❌ NO SHOPIFY CONNECTION ROW FOR THIS TENANT');
        } else {
          const adminTokenPresent = typeof shopify?.config?.admin_token === 'string'
            && shopify.config.admin_token.length > 0;
          console.error(`SHOPIFY CONNECTION: enabled=${shopify.enabled}, admin_token present (masked)=${adminTokenPresent}`);
          console.error(`SHOPIFY CONFIG: ${JSON.stringify(shopify.config)}`);
        }
      } catch (e: any) {
        console.error(`Connection probe failed: ${e?.message ?? e}`);
      }

      // 4. failed requests / console errors
      console.error(`FAILED REQUESTS (${failedRequests.length}):`);
      failedRequests.slice(0, 20).forEach((r) => console.error('  ' + r));
      console.error(`CONSOLE ERRORS (${consoleErrors.length}):`);
      consoleErrors.slice(0, 20).forEach((e) => console.error('  ' + e));
      console.error(`========== END DIAGNOSTICS ==========\n`);
    };

    // ---- assertions ----
    const previewText = await preview.innerText().catch(() => '');
    const hasEmptyText = previewText.includes('无商品数据');
    const productImg = preview.locator('div[style*="border"] img').first();
    const hasProductImg = await productImg.isVisible({ timeout: 1_000 }).catch(() => false);

    if (hasEmptyText || !hasProductImg) {
      await dumpDiagnostics(hasEmptyText ? '「无商品数据」 EMPTY STATE RENDERED' : 'NO PRODUCT IMG FOUND');
    }

    // Hard assertions — the test FAILS if either is true:
    expect(hasEmptyText, 'preview must NOT contain 「无商品数据」 empty-state text').toBe(false);
    await expect(productImg, 'preview must show ≥1 product card with <img>').toBeVisible({ timeout: 5_000 });
  });
});
