import { type Page, expect } from '@playwright/test';
import { TID } from '../helpers/test-ids';

/** Page Object for Apps and per-App overview/build/chat shell. */
export class AppPage {
  constructor(private page: Page) {}

  async goto() {
    // PLANET-1407: legacy /app dual-pane removed; the canonical entry point
    // is the Apps list, where the template picker now lives.
    await this.page.goto('/apps');
    await this.page.waitForLoadState('networkidle');
  }

  async createFromEcommerceTemplate() {
    await this.openTemplatePicker();
    await this.page.getByTestId(TID.templateBtn('ecommerce-starter')).click();
  }

  async createFromStarterTemplate() {
    await this.openTemplatePicker();
    const tplResp = this.page.waitForResponse(r => r.url().includes('/api/apps/from-template') && r.request().method() === 'POST');
    await this.page.getByTestId(TID.templateBtn('starter-app')).click();
    const resp = await tplResp;
    const body = await resp.json().catch(() => null) as { app?: { id?: string } } | null;
    const newId = body?.app?.id;
    if (newId) {
      // Wait for /api/apps/<newId> to be fetched (this is what populates components for the new app).
      await this.page.waitForResponse(
        r => r.url().includes(`/api/apps/${newId}`) && !r.url().endsWith('/secrets') && !r.url().endsWith('/scheduled-tasks') && r.request().method() === 'GET',
        { timeout: 15_000 },
      ).catch(() => {});
    }
  }

  async openTemplatePicker() {
    await this.page.getByTestId(TID.newAppBtn).click();
  }

  async createFromTemplate(templateId: string) {
    await this.openTemplatePicker();
    await this.page.getByTestId(TID.templateBtn(templateId)).click();
  }

  async openBuildPage() {
    await this.page.getByTestId('inner-nav-build').click();
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
