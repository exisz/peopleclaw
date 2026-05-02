import { type Page, expect } from '@playwright/test';
import { TID } from '../helpers/test-ids';
import { CanvasPage } from './CanvasPage';

/**
 * Page Object for /app — the dual-pane Chat + Canvas interface.
 */
export class AppPage {
  readonly canvas: CanvasPage;

  constructor(private page: Page) {
    this.canvas = new CanvasPage(page);
  }

  async goto() {
    await this.page.goto('/app');
    await this.page.waitForLoadState('networkidle');
  }

  async createFromEcommerceTemplate() {
    await this.openTemplatePicker();
    await this.page.getByTestId(TID.templateBtn('ecommerce-starter')).click();
  }

  async createFromStarterTemplate() {
    await this.openTemplatePicker();
    // Capture pre-click selectedAppId to wait for it to actually change to the new one.
    const preId = await this.page.locator('[data-testid="app-selector"]').inputValue().catch(() => '');
    const tplResp = this.page.waitForResponse(r => r.url().includes('/api/apps/from-template') && r.request().method() === 'POST');
    await this.page.getByTestId(TID.templateBtn('starter-app')).click();
    const resp = await tplResp;
    const body = await resp.json().catch(() => null) as { app?: { id?: string } } | null;
    const newId = body?.app?.id;
    if (newId) {
      // Wait for the dropdown's selected value to flip to the new app, then for its components to load.
      await this.page.locator('[data-testid="app-selector"]').filter({ hasText: '' }).first().waitFor({ timeout: 10_000 }).catch(() => {});
      await this.page.waitForFunction(
        (id) => (document.querySelector('[data-testid="app-selector"]') as HTMLSelectElement | null)?.value === id,
        newId,
        { timeout: 10_000 },
      );
    } else if (preId) {
      // Fallback: wait for selector to change at all.
      await this.page.waitForFunction(
        (prev) => (document.querySelector('[data-testid="app-selector"]') as HTMLSelectElement | null)?.value !== prev,
        preId,
        { timeout: 10_000 },
      );
    }
  }

  async openTemplatePicker() {
    await this.page.getByTestId(TID.newAppBtn).click();
  }

  async createFromTemplate(templateId: string) {
    await this.openTemplatePicker();
    await this.page.getByTestId(TID.templateBtn(templateId)).click();
  }

  async openModuleList() {
    // PLANET-1468: Module list is now a top-level tab; the count is in the tab label.
    // Just hover/no-op — the assertion checks the tab label text which is always visible.
    return;
  }

  async expectModuleStatus(componentId: string, status: string) {
    await expect(this.page.getByTestId(TID.moduleListStatus(componentId))).toContainText(status);
  }

  /** Switch to detail tab */
  async switchToDetail() {
    await this.page.getByTestId(TID.tabComponentDetail).click();
  }

  /** Get the result JSON pre element */
  resultJson() {
    return this.page.getByTestId(TID.detailResultJson);
  }

  /** Get fullstack preview container */
  fullstackPreview() {
    return this.page.getByTestId(TID.detailFullstackPreview);
  }
}
