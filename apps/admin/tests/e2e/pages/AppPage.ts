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
    await this.page.getByTestId(TID.templateBtn('starter-app')).click();
  }

  async openTemplatePicker() {
    await this.page.getByTestId(TID.newAppBtn).click();
  }

  async createFromTemplate(templateId: string) {
    await this.openTemplatePicker();
    await this.page.getByTestId(TID.templateBtn(templateId)).click();
  }

  async openModuleList() {
    await this.page.getByTestId(TID.moduleListDrawerToggle).click();
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
