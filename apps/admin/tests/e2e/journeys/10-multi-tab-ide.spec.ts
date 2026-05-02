/**
 * PLANET-1468: IDE-style multi-tab UI.
 *
 * GIVEN starter-app (4 components)
 * WHEN  click components on the canvas → tabs appear at the top
 * THEN  multiple tabs coexist, can be switched, closed, and persist across reload.
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC10: IDE 多 tab', () => {
  test('打开/切换/关闭/重开 + reload 持久化', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(180_000);

    const app = new AppPage(page);
    await app.goto();

    // Create starter-app via template
    await app.createFromStarterTemplate();

    // Wait for canvas + 4 nodes
    const nodeLocator = page.locator('[data-canvas-node="true"]');
    await expect(nodeLocator).toHaveCount(4, { timeout: 30_000 });

    // Permanent tabs visible
    await expect(page.getByTestId('tab-flow-graph')).toBeVisible();
    await expect(page.getByTestId('tab-module-list')).toBeVisible();
    await expect(page.getByTestId('tab-app-secrets')).toBeVisible();
    await expect(page.getByTestId('tab-app-scheduled')).toBeVisible();

    // Permanent tabs MUST NOT have ✕ close buttons
    expect(await page.getByTestId('tab-close-flow').count()).toBe(0);
    expect(await page.getByTestId('tab-close-list').count()).toBe(0);
    expect(await page.getByTestId('tab-close-secrets').count()).toBe(0);
    expect(await page.getByTestId('tab-close-scheduled').count()).toBe(0);

    // Click first node (FRONTEND or whichever shows up first) — opens a new tab
    const firstNode = nodeLocator.nth(0);
    const firstNodeId = (await firstNode.getAttribute('data-testid'))!.replace('canvas-node-', '');
    await firstNode.click();

    const tabA = page.getByTestId(`tab-component-${firstNodeId}`);
    await expect(tabA).toBeVisible({ timeout: 5_000 });
    await expect(tabA).toHaveAttribute('data-tab-active', 'true');
    // Close button exists
    await expect(page.getByTestId(`tab-close-${firstNodeId}`)).toBeVisible();

    // Click a second node — should open a second tab; first stays
    const secondNode = nodeLocator.nth(1);
    const secondNodeId = (await secondNode.getAttribute('data-testid'))!.replace('canvas-node-', '');
    if (secondNodeId === firstNodeId) {
      throw new Error('expected distinct second node');
    }
    // Switch back to flow tab to actually click on canvas
    await page.getByTestId('tab-flow-graph').click();
    await secondNode.click();

    const tabB = page.getByTestId(`tab-component-${secondNodeId}`);
    await expect(tabB).toBeVisible();
    await expect(tabB).toHaveAttribute('data-tab-active', 'true');
    await expect(tabA).toBeVisible(); // still there

    // Switch back to first tab → it becomes active
    await tabA.click();
    await expect(tabA).toHaveAttribute('data-tab-active', 'true');

    // Same component click should not duplicate the tab
    await page.getByTestId('tab-flow-graph').click();
    await firstNode.click();
    expect(await page.getByTestId(`tab-component-${firstNodeId}`).count()).toBe(1);

    // Close tab A → should disappear, active falls back to 'flow' (since A was active)
    await tabA.click(); // make sure A is active
    await page.getByTestId(`tab-close-${firstNodeId}`).click();
    expect(await page.getByTestId(`tab-component-${firstNodeId}`).count()).toBe(0);
    await expect(page.getByTestId('tab-flow-graph')).toHaveAttribute('data-tab-active', 'true');
    await expect(tabB).toBeVisible(); // B still there

    // Re-click first node → opens fresh tab
    await firstNode.click();
    await expect(page.getByTestId(`tab-component-${firstNodeId}`)).toBeVisible();

    // Reload page → tabs restored from localStorage
    const url = page.url();
    await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });
    await expect(nodeLocator).toHaveCount(4, { timeout: 30_000 });
    await expect(page.getByTestId(`tab-component-${firstNodeId}`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`tab-component-${secondNodeId}`)).toBeVisible();

    // localStorage key shape — appId in URL → key=peopleclaw:openTabs:<appId>
    const appId = url.match(/\/app\/([^/?#]+)/)?.[1];
    if (appId) {
      const stored = await page.evaluate((k) => localStorage.getItem(k), `peopleclaw:openTabs:${appId}`);
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(Array.isArray(parsed.openTabIds)).toBe(true);
      expect(parsed.openTabIds).toContain(firstNodeId);
      expect(parsed.openTabIds).toContain(secondNodeId);
      expect(parsed.openTabIds).toContain('flow');
      expect(parsed.openTabIds).toContain('list');
    }

    // Close all component tabs → active falls back to flow
    await page.getByTestId(`tab-close-${firstNodeId}`).click();
    await page.getByTestId(`tab-close-${secondNodeId}`).click();
    await expect(page.getByTestId('tab-flow-graph')).toHaveAttribute('data-tab-active', 'true');

    // Touch helper var so it's not flagged unused if assertions branch
    expect(TID.tabFlowGraph).toBe('tab-flow-graph');
  });
});
