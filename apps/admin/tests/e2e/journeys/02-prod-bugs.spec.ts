/**
 * REGRESSION: PLANET-1432 — starter-app prod bugs
 * 1. FRONTEND preview must NOT emit "react/jsx-runtime" resolution errors
 * 2. FULLSTACK/BACKEND compile must NOT error on "export const server" for function-declaration exports
 *
 * These tests add page-level error listeners that fail on ANY console error / page error.
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

// PLANET-1436: Also catch hooks errors when navigating to /app/:id
test.describe('PLANET-1436: /app/:id hooks guard', () => {
  test('No hooks violation navigating to existing /app/:id', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(60_000);

    const hookErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (/hook|rendered more|rendered fewer/i.test(err.message)) {
        hookErrors.push(err.message);
      }
    });

    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 30_000 });
    const appLink = page.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'No apps to navigate to');
      return;
    }
    await appLink.click();
    await page.waitForURL(/\/app\//, { timeout: 15_000 });
    await page.waitForTimeout(2000);

    expect(hookErrors, `Hooks violation: ${hookErrors.join('; ')}`).toHaveLength(0);
  });
});

test.describe('PLANET-1432: Starter-app prod bug regression', () => {
  test('No console errors when previewing FRONTEND and FULLSTACK components', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(180_000);

    // Collect page errors and console errors
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore Vite HMR noise
        if (text.includes('[vite]') || text.includes('WebSocket')) return;
        consoleErrors.push(text);
      }
    });

    const app = new AppPage(page);
    await app.goto();

    // Create starter-app
    await app.createFromStarterTemplate();

    // Wait for nodes
    const frontendNode = app.canvas.nodeByType('FRONTEND');
    const fullstackNode = app.canvas.nodeByType('FULLSTACK');
    await expect(frontendNode).toBeVisible({ timeout: 15_000 });
    await expect(fullstackNode).toBeVisible({ timeout: 15_000 });

    // Click FRONTEND → should default to preview tab → compile + render
    await frontendNode.click();
    await expect(page.getByTestId(TID.detailSubTabPreview)).toBeVisible({ timeout: 5_000 });
    // Wait for preview to load (compile + render)
    await expect(page.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });
    // Give it a moment for async errors to surface
    await page.waitForTimeout(2000);

    // Assert no react/jsx-runtime or module resolution errors
    expect(pageErrors.filter(e => e.message.includes('jsx-runtime') || e.message.includes('module specifier'))).toHaveLength(0);
    expect(consoleErrors.filter(e => e.includes('jsx-runtime') || e.includes('module specifier'))).toHaveLength(0);

    // Click FULLSTACK → preview tab → should compile and render without "export const server" error
    await page.getByTestId(TID.tabFlowGraph).click();
    await fullstackNode.click();
    await expect(page.getByTestId(TID.detailSubTabFlow)).toBeVisible({ timeout: 5_000 });
    await page.getByTestId(TID.detailSubTabPreview).click();
    await expect(page.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);

    // Final assertion: NO page errors at all, NO console errors
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });
});
