# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journeys/11-crm-app.spec.ts >> TC11: CRM App 模板 — connector-free 全流程 >> 创建 crm-app → 验证 4 组件 → 提交联系人 → 提交跟进
- Location: tests/e2e/journeys/11-crm-app.spec.ts:17:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('component-tab-content-cmot6yuu20029jy046abwk5t8').getByTestId('crm-contact-list')
Expected substring: "王小明-yv88"
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 30000ms
  - waiting for getByTestId('component-tab-content-cmot6yuu20029jy046abwk5t8').getByTestId('crm-contact-list')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - link "P PeopleClaw" [ref=e6] [cursor=pointer]:
        - /url: /apps
        - generic [ref=e7]: P
        - generic [ref=e8]: PeopleClaw
      - button "E2E Workspace" [ref=e9]:
        - img
        - generic [ref=e10]: E2E Workspace
      - button "切换主题" [ref=e11]:
        - img
      - button "Toggle language" [ref=e12]:
        - img
      - button "User menu" [ref=e13]:
        - generic [ref=e14]: E
    - generic [ref=e15]:
      - complementary [ref=e16]:
        - navigation [ref=e17]:
          - link "Apps" [ref=e18] [cursor=pointer]:
            - /url: /apps
            - img [ref=e19]
            - text: Apps
          - link "Published" [ref=e22] [cursor=pointer]:
            - /url: /published
            - img [ref=e23]
            - text: Published
          - link "Security" [ref=e26] [cursor=pointer]:
            - /url: /security
            - img [ref=e27]
            - text: Security
          - link "Settings" [ref=e29] [cursor=pointer]:
            - /url: /settings
            - img [ref=e30]
            - text: Settings
        - 'link "Credits: 20" [ref=e34] [cursor=pointer]':
          - /url: /credits
          - generic [ref=e35]:
            - img [ref=e36]
            - text: "Credits: 20"
      - main [ref=e41]:
        - generic [ref=e43]:
          - generic [ref=e45]:
            - generic [ref=e47]:
              - paragraph [ref=e48]: 💬
              - paragraph [ref=e49]: 开始和 AI 对话吧
            - generic [ref=e50]:
              - textbox "输入消息..." [ref=e51]
              - button "发送" [disabled] [ref=e52]
          - separator [ref=e53]
          - generic [ref=e55]:
            - generic [ref=e56]:
              - combobox [ref=e57]:
                - option "CRM 起步示例 App" [selected]
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "CRM 起步示例 App"
                - option "CRM 起步示例 App"
                - option "CRM 起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "CRM 起步示例 App"
                - option "CRM 起步示例 App"
                - option "CRM 起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "CRM 起步示例 App"
                - option "CRM 起步示例 App"
                - option "CRM 起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "AI Canvas Test App"
                - option "AI Canvas Test App"
                - option "AI Canvas Test App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "AI Canvas Test App"
                - option "AI Canvas Test App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "AI Canvas Test App"
                - option "AI Canvas Test App"
                - option "AI Canvas Test App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "起步示例 App"
                - option "AI 换脸上传"
                - option "表单 Starter"
                - option "通用表格"
                - option "通用表格"
                - option "电商起步"
              - button "+ New App" [ref=e58]
            - generic [ref=e59]:
              - generic [ref=e60] [cursor=pointer]:
                - generic [ref=e61]: 📊
                - generic [ref=e62]: 模块流程图
              - generic [ref=e63] [cursor=pointer]:
                - generic [ref=e64]: 📋
                - generic [ref=e65]: 模块列表 (4)
              - generic [ref=e66] [cursor=pointer]:
                - generic [ref=e67]: 🔐
                - generic [ref=e68]: Secrets
              - generic [ref=e69] [cursor=pointer]:
                - generic [ref=e70]: ⏰
                - generic [ref=e71]: 定时任务
              - generic [ref=e72] [cursor=pointer]:
                - generic [ref=e73]: 🎨
                - generic [ref=e74]: 联系人表单
                - button "close tab" [ref=e75]: ✕
              - generic [ref=e76] [cursor=pointer]:
                - generic [ref=e77]: 🔗
                - generic [ref=e78]: 联系人列表
                - button "close tab" [ref=e79]: ✕
              - button "add tab" [ref=e81]: +
            - generic [ref=e85]:
              - generic [ref=e86]:
                - button "运行" [active] [ref=e87]
                - button "代码" [ref=e88]
                - button "流程" [ref=e89]
              - generic [ref=e92]:
                - button "加载预览" [ref=e93]
                - paragraph [ref=e94]: "Could not find `export const Client` or `export function Client` in fullstack source"
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | /**
  2   |  * USER STORY: CRM App 模板 — 4 组件 + 2 TRIGGER 全流程 (PLANET-1542)
  3   |  *
  4   |  * GIVEN 已登录
  5   |  * WHEN  选 crm-app 模板
  6   |  * THEN  canvas 出现 4 节点 (2 FRONTEND + 2 FULLSTACK)
  7   |  * AND   提交联系人 → 联系人列表里出现该人
  8   |  * AND   提交跟进 → 跟进时间线里出现该条
  9   |  *
  10  |  * Canonical: spec §17 (PLANET-1542 钦定 connector-free 第 2 模板).
  11  |  */
  12  | import { test, expect } from '../fixtures/auth';
  13  | import { AppPage } from '../pages/AppPage';
  14  | import { TID } from '../helpers/test-ids';
  15  | 
  16  | test.describe('TC11: CRM App 模板 — connector-free 全流程', () => {
  17  |   test('创建 crm-app → 验证 4 组件 → 提交联系人 → 提交跟进', async ({ authedPage }) => {
  18  |     const page = authedPage;
  19  |     test.setTimeout(180_000);
  20  | 
  21  |     const app = new AppPage(page);
  22  |     await app.goto();
  23  | 
  24  |     // Step 1: 选 crm-app 模板
  25  |     await app.openTemplatePicker();
  26  |     const tplResp = page.waitForResponse(
  27  |       r => r.url().includes('/api/apps/from-template') && r.request().method() === 'POST',
  28  |     );
  29  |     await page.getByTestId(TID.templateBtn('crm-app')).click();
  30  |     const resp = await tplResp;
  31  |     const body = await resp.json().catch(() => null) as { app?: { id?: string } } | null;
  32  |     const newId = body?.app?.id;
  33  |     expect(newId).toBeTruthy();
  34  |     if (newId) {
  35  |       await page.waitForResponse(
  36  |         r => r.url().includes(`/api/apps/${newId}`)
  37  |           && !r.url().endsWith('/secrets')
  38  |           && !r.url().endsWith('/scheduled-tasks')
  39  |           && r.request().method() === 'GET',
  40  |         { timeout: 15_000 },
  41  |       ).catch(() => {});
  42  |     }
  43  | 
  44  |     // Step 2: 验证模块列表显示 4 项
  45  |     await expect(page.getByTestId('tab-module-list')).toContainText('(4)', { timeout: 10_000 });
  46  | 
  47  |     // Step 3: 拿到 4 个 component id (按 name 索引)
  48  |     await page.getByTestId('tab-module-list').click();
  49  |     const idOf = async (label: string): Promise<string> => {
  50  |       const row = page.locator('[data-testid^="module-list-row-"]').filter({ hasText: label }).first();
  51  |       const tid = await row.getAttribute('data-testid');
  52  |       return tid!.replace('module-list-row-', '');
  53  |     };
  54  |     const contactFormId = await idOf('联系人表单');
  55  |     const contactListId = await idOf('联系人列表');
  56  |     const followupFormId = await idOf('跟进记录表单');
  57  |     const timelineId = await idOf('跟进时间线');
  58  |     expect(contactFormId).toBeTruthy();
  59  |     expect(contactListId).toBeTruthy();
  60  |     expect(followupFormId).toBeTruthy();
  61  |     expect(timelineId).toBeTruthy();
  62  | 
  63  |     // Step 4: 打开联系人表单 → 提交一个联系人
  64  |     await page.locator(`[data-testid="module-list-row-${contactFormId}"]`).click();
  65  |     await expect(page.getByTestId(`tab-component-${contactFormId}`)).toBeVisible({ timeout: 10_000 });
  66  |     const formPanel = page.getByTestId(`component-tab-content-${contactFormId}`);
  67  |     await expect(formPanel).toBeVisible();
  68  |     // FRONTEND default tab = preview (per spec §17 节点点击行为规则)
  69  |     await expect(formPanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });
  70  | 
  71  |     const contactName = '王小明-' + Date.now().toString(36).slice(-4);
  72  |     await formPanel.getByTestId('crm-contact-name').fill(contactName);
  73  |     await formPanel.getByTestId('crm-contact-company').fill('Acme Corp');
  74  |     await formPanel.getByTestId('crm-contact-email').fill('wxm@example.com');
  75  |     await formPanel.getByTestId('crm-contact-submit').click();
  76  |     await expect(formPanel.getByTestId('crm-contact-saved')).toBeVisible({ timeout: 30_000 });
  77  | 
  78  |     // Step 5: 打开联系人列表 (FULLSTACK) → preview tab → 验证表里有该人
  79  |     await page.getByTestId('tab-module-list').click();
  80  |     await page.locator(`[data-testid="module-list-row-${contactListId}"]`).click();
  81  |     await expect(page.getByTestId(`tab-component-${contactListId}`)).toBeVisible({ timeout: 10_000 });
  82  |     const listPanel = page.getByTestId(`component-tab-content-${contactListId}`);
  83  |     await listPanel.getByTestId(TID.detailSubTabPreview).click();
  84  |     await expect(listPanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });
> 85  |     await expect(listPanel.getByTestId('crm-contact-list')).toContainText(contactName, { timeout: 30_000 });
      |                                                             ^ Error: expect(locator).toContainText(expected) failed
  86  | 
  87  |     // Pull contact id out of the rendered table for the followup step
  88  |     const rowLocator = listPanel.locator('[data-testid^="crm-contact-row-"]').filter({ hasText: contactName }).first();
  89  |     const rowTid = await rowLocator.getAttribute('data-testid');
  90  |     const cId = rowTid!.replace('crm-contact-row-', '');
  91  |     expect(cId).toBeTruthy();
  92  | 
  93  |     // Step 6: 打开跟进记录表单 → 提交一条
  94  |     await page.getByTestId('tab-module-list').click();
  95  |     await page.locator(`[data-testid="module-list-row-${followupFormId}"]`).click();
  96  |     await expect(page.getByTestId(`tab-component-${followupFormId}`)).toBeVisible({ timeout: 10_000 });
  97  |     const followupFormPanel = page.getByTestId(`component-tab-content-${followupFormId}`);
  98  |     await expect(followupFormPanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });
  99  | 
  100 |     const note = '初次接洽-' + Date.now().toString(36).slice(-4);
  101 |     await followupFormPanel.getByTestId('crm-followup-contact-id').fill(cId);
  102 |     await followupFormPanel.getByTestId('crm-followup-type').selectOption('email');
  103 |     await followupFormPanel.getByTestId('crm-followup-note').fill(note);
  104 |     await followupFormPanel.getByTestId('crm-followup-submit').click();
  105 |     await expect(followupFormPanel.getByTestId('crm-followup-saved')).toBeVisible({ timeout: 30_000 });
  106 | 
  107 |     // Step 7: 打开跟进时间线 → preview tab → 验证有该条
  108 |     await page.getByTestId('tab-module-list').click();
  109 |     await page.locator(`[data-testid="module-list-row-${timelineId}"]`).click();
  110 |     await expect(page.getByTestId(`tab-component-${timelineId}`)).toBeVisible({ timeout: 10_000 });
  111 |     const timelinePanel = page.getByTestId(`component-tab-content-${timelineId}`);
  112 |     await timelinePanel.getByTestId(TID.detailSubTabPreview).click();
  113 |     await expect(timelinePanel.getByTestId('detail-fullstack-preview')).toBeVisible({ timeout: 30_000 });
  114 |     await expect(timelinePanel.getByTestId('crm-followup-timeline')).toContainText(note, { timeout: 30_000 });
  115 |     await expect(timelinePanel.getByTestId('crm-followup-timeline')).toContainText(contactName, { timeout: 30_000 });
  116 |   });
  117 | });
  118 | 
```