import { type Page, expect } from '@playwright/test';
import { TID } from '../helpers/test-ids';

/**
 * Page Object for the /app canvas pane.
 * Encapsulates xyflow node interactions.
 */
export class CanvasPage {
  constructor(private page: Page) {}

  /** Locate a canvas node by its component ID */
  node(componentId: string) {
    return this.page.getByTestId(TID.canvasNode(componentId));
  }

  /** Find a canvas node wrapper by type text (BACKEND/FULLSTACK/FRONTEND) */
  nodeByType(type: string) {
    return this.page
      .locator('[data-canvas-node="true"]')
      .filter({ hasText: type })
      .first();
  }

  /** Extract the component ID from a found node element */
  async getNodeId(nodeLocator: ReturnType<typeof this.nodeByType>): Promise<string> {
    const testId = await nodeLocator.getAttribute('data-testid');
    return testId!.replace('canvas-node-', '');
  }

  /** Click the ▶ Run button on a node */
  async runNode(componentId: string) {
    const btn = this.page.getByTestId(TID.canvasNodeRunBtn(componentId));
    await expect(btn).toBeVisible();
    await btn.click();
  }

  /**
   * Wait for a node's status to reach the target value.
   * Since xyflow node re-renders can be unreliable for data-testid changes,
   * we also support watching the detail panel probe timeline as a fallback.
   */
  async waitStatus(componentId: string, status: 'done' | 'error', timeoutMs = 45_000) {
    // Primary: watch the data-testid status element
    const statusLocator = this.page.getByTestId(TID.canvasNodeStatus(componentId, status));
    await expect(statusLocator).toBeVisible({ timeout: timeoutMs });
  }

  /** Get probe step names visible in the detail panel */
  async getProbeSteps(): Promise<string[]> {
    const steps = this.page.locator('[data-testid^="detail-probe-step-"]');
    const count = await steps.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const testId = await steps.nth(i).getAttribute('data-testid');
      if (testId) names.push(testId.replace('detail-probe-step-', ''));
    }
    return names;
  }
}
