/**
 * USER STORY: CRM App 模板 — 4 组件 + 2 TRIGGER 全流程 (PLANET-1542)
 *
 * GIVEN 已登录
 * WHEN  选 crm-app 模板
 * THEN  canvas 出现 4 节点 (2 FRONTEND + 2 FULLSTACK)
 * AND   提交联系人 → 联系人列表里出现该人
 * AND   提交跟进 → 跟进时间线里出现该条
 *
 * Canonical: spec §17 (PLANET-1542 钦定 connector-free 第 2 模板).
 */
import { test, expect } from '../fixtures/auth';
import { AppPage } from '../pages/AppPage';
import { TID } from '../helpers/test-ids';

test.describe('TC11: CRM App 模板 — connector-free 全流程', () => {
  test('创建 crm-app → 验证 4 组件 → 提交联系人 → 提交跟进', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(180_000);

    const app = new AppPage(page);
    await app.goto();

    // Step 1: 选 crm-app 模板
    await app.openTemplatePicker();
    const tplResp = page.waitForResponse(
      r => r.url().includes('/api/apps/from-template') && r.request().method() === 'POST',
    );
    await page.getByTestId(TID.templateBtn('crm-app')).click();
    const resp = await tplResp;
    const body = await resp.json().catch(() => null) as { app?: { id?: string } } | null;
    const newId = body?.app?.id;
    expect(newId).toBeTruthy();
    if (newId) {
      await page.waitForResponse(
        r => r.url().includes(`/api/apps/${newId}`)
          && !r.url().endsWith('/secrets')
          && !r.url().endsWith('/scheduled-tasks')
          && r.request().method() === 'GET',
        { timeout: 15_000 },
      ).catch(() => {});
    }

    // Step 2: 验证模块列表显示 4 项
    await expect(page.getByTestId('tab-module-list')).toContainText('(4)', { timeout: 10_000 });

    // Step 3: 拿到 4 个 component id (按 name 索引)
    await page.getByTestId('tab-module-list').click();
    const idOf = async (label: string): Promise<string> => {
      const row = page.locator('[data-testid^="module-list-row-"]').filter({ hasText: label }).first();
      const tid = await row.getAttribute('data-testid');
      return tid!.replace('module-list-row-', '');
    };
    const contactFormId = await idOf('联系人表单');
    const contactListId = await idOf('联系人列表');
    const followupFormId = await idOf('跟进记录表单');
    const timelineId = await idOf('跟进时间线');
    expect(contactFormId).toBeTruthy();
    expect(contactListId).toBeTruthy();
    expect(followupFormId).toBeTruthy();
    expect(timelineId).toBeTruthy();

    // Step 4: 打开联系人表单 → 提交一个联系人
    await page.locator(`[data-testid="module-list-row-${contactFormId}"]`).click();
    await expect(page.getByTestId(`tab-component-${contactFormId}`)).toBeVisible({ timeout: 10_000 });
    const formPanel = page.getByTestId(`component-tab-content-${contactFormId}`);
    await expect(formPanel).toBeVisible();
    // FRONTEND default tab = preview (per spec §17 节点点击行为规则)
    await expect(formPanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });

    const contactName = '王小明-' + Date.now().toString(36).slice(-4);
    await formPanel.getByTestId('crm-contact-name').fill(contactName);
    await formPanel.getByTestId('crm-contact-company').fill('Acme Corp');
    await formPanel.getByTestId('crm-contact-email').fill('wxm@example.com');
    await formPanel.getByTestId('crm-contact-submit').click();
    await expect(formPanel.getByTestId('crm-contact-saved')).toBeVisible({ timeout: 30_000 });

    // Step 5: 打开联系人列表 (FULLSTACK) → preview tab → 验证表里有该人
    await page.getByTestId('tab-module-list').click();
    await page.locator(`[data-testid="module-list-row-${contactListId}"]`).click();
    await expect(page.getByTestId(`tab-component-${contactListId}`)).toBeVisible({ timeout: 10_000 });
    const listPanel = page.getByTestId(`component-tab-content-${contactListId}`);
    await listPanel.getByTestId(TID.detailSubTabPreview).click();
    await expect(listPanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByTestId('crm-contact-list')).toContainText(contactName, { timeout: 30_000 });

    // Pull contact id out of the rendered table for the followup step
    const rowLocator = listPanel.locator('[data-testid^="crm-contact-row-"]').filter({ hasText: contactName }).first();
    const rowTid = await rowLocator.getAttribute('data-testid');
    const cId = rowTid!.replace('crm-contact-row-', '');
    expect(cId).toBeTruthy();

    // Step 6: 打开跟进记录表单 → 提交一条
    await page.getByTestId('tab-module-list').click();
    await page.locator(`[data-testid="module-list-row-${followupFormId}"]`).click();
    await expect(page.getByTestId(`tab-component-${followupFormId}`)).toBeVisible({ timeout: 10_000 });
    const followupFormPanel = page.getByTestId(`component-tab-content-${followupFormId}`);
    await expect(followupFormPanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });

    const note = '初次接洽-' + Date.now().toString(36).slice(-4);
    await followupFormPanel.getByTestId('crm-followup-contact-id').fill(cId);
    await followupFormPanel.getByTestId('crm-followup-type').selectOption('email');
    await followupFormPanel.getByTestId('crm-followup-note').fill(note);
    await followupFormPanel.getByTestId('crm-followup-submit').click();
    await expect(followupFormPanel.getByTestId('crm-followup-saved')).toBeVisible({ timeout: 30_000 });

    // Step 7: 打开跟进时间线 → preview tab → 验证有该条
    await page.getByTestId('tab-module-list').click();
    await page.locator(`[data-testid="module-list-row-${timelineId}"]`).click();
    await expect(page.getByTestId(`tab-component-${timelineId}`)).toBeVisible({ timeout: 10_000 });
    const timelinePanel = page.getByTestId(`component-tab-content-${timelineId}`);
    await timelinePanel.getByTestId(TID.detailSubTabPreview).click();
    await expect(timelinePanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });
    await expect(timelinePanel.getByTestId('crm-followup-timeline')).toContainText(note, { timeout: 30_000 });
    await expect(timelinePanel.getByTestId('crm-followup-timeline')).toContainText(contactName, { timeout: 30_000 });
  });
});
