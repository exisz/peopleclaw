import { test, expect } from './fixtures/auth';

test.use({ viewport: { width: 1440, height: 900 } });

test('PLANET-1213: capture screenshots for Elen visibility analysis', async ({ authedPage: page }) => {
  // 01: workflows list
  await page.goto('/workflows');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/planet-1213-screenshots/01-workflows-list.png', fullPage: false });

  // 02: select a workflow, show topbar
  const firstWorkflow = page.locator('[data-testid^="sidebar-workflow-"]').first();
  await firstWorkflow.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const topbar = page.locator('[data-testid="app-topbar"]');
  await topbar.screenshot({ path: '/tmp/planet-1213-screenshots/02-workflow-selected-topbar.png' });
  await page.screenshot({ path: '/tmp/planet-1213-screenshots/02-workflow-selected-full.png', fullPage: false });

  // 03: hover over a workflow in sidebar to reveal ... menu
  await page.goto('/workflows');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const firstSidebarWf = page.locator('[data-testid^="sidebar-workflow-"]').first();
  await firstSidebarWf.hover();
  await page.waitForTimeout(500);
  const menuBtn = page.locator('[data-testid^="sidebar-workflow-menu-"]').first();
  const isVisible = await menuBtn.isVisible().catch(() => false);
  if (isVisible) {
    await menuBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: '/tmp/planet-1213-screenshots/03-sidebar-menu-hover.png', fullPage: false });

  // 04: select Shopify template workflow
  await page.goto('/workflows/shopify-direct-listing');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const topbar2 = page.locator('[data-testid="app-topbar"]');
  await topbar2.screenshot({ path: '/tmp/planet-1213-screenshots/04-shopify-template.png' });
  await page.screenshot({ path: '/tmp/planet-1213-screenshots/04-shopify-template-full.png', fullPage: false });

  // 05: cases page
  await page.goto('/cases');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/planet-1213-screenshots/05-cases-page.png', fullPage: false });
});
