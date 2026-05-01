/**
 * PLANET-1434: AI tool-calling 改画布
 *
 * GIVEN 已登录, 空 App
 * WHEN  chat 发 "apply starter-app template"
 * THEN  画布出 3 节点
 * WHEN  chat 发 "delete 商品列表 component"
 * THEN  画布剩 2 节点
 * AND   全程 0 console error
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC3: AI tool-calling 改画布', () => {
  test('chat 指令操纵画布 — apply template + delete component', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(120_000);

    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new AppPage(page);
    await app.goto();

    // Create a blank app first
    await app.openTemplatePicker();
    await page.getByTestId(TID.templateBlankBtn).click();
    // Fill prompt for blank app name
    page.once('dialog', d => d.accept('AI Canvas Test App'));
    await page.waitForTimeout(1000);

    // Wait for empty canvas
    await expect(page.getByTestId(TID.canvasPane)).toBeVisible({ timeout: 10_000 });

    // Step 1: Chat "apply starter-app template"
    await page.getByTestId(TID.chatInput).fill('apply starter-app template');
    await page.getByTestId(TID.chatSendBtn).click();

    // Wait for 3 nodes to appear on canvas (tool-call triggers canvas update)
    const nodeLocator = page.locator('[data-testid^="canvas-node-"]');
    await expect(nodeLocator).toHaveCount(3, { timeout: 30_000 });

    // Verify tool-call card is shown (not raw JSON)
    const assistantMsg = page.locator('[data-testid^="chat-message-"]').last();
    await expect(assistantMsg).not.toContainText('"tool_calls"', { timeout: 5_000 });
    await expect(assistantMsg).toContainText('✓', { timeout: 5_000 });

    // Step 2: Chat "delete 商品列表 component"
    await page.getByTestId(TID.chatInput).fill('delete 商品列表 component');
    await page.getByTestId(TID.chatSendBtn).click();

    // Wait for canvas to have 2 nodes
    await expect(nodeLocator).toHaveCount(2, { timeout: 30_000 });

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });
});
