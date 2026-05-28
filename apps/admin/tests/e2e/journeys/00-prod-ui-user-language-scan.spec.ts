import { test, expect, type Page } from '../fixtures/auth';

const forbiddenPatterns = [
  /\bComponent\b/i,
  /\bModule\b/i,
  /\bFULLSTACK\b/,
  /\bFRONTEND\b/,
  /\bBACKEND\b/,
  /exported component/i,
  /\bprobe\b/i,
  /\bgraph\b/i,
  /\bcanvas\b/i,
  /\bworkflow\b/i,
];

async function visibleText(page: Page) {
  return page.locator('body').innerText({ timeout: 15_000 });
}

async function expectNoInternalLanguage(page: Page, surface: string) {
  const text = await visibleText(page);
  const violations = forbiddenPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `${surface}: ${pattern}`);

  expect(violations, `Non-technical surface exposed internal builder language. Visible text:\n${text}`).toEqual([]);
}

test('prod-ui: app surfaces speak app-building language, not component/runtime internals', async ({ authedPage: page, baseURL }) => {
  expect(baseURL, 'user-language scan must target the production app host').toContain(
    'app.peopleclaw.rollersoft.com.au',
  );

  await page.goto('/apps');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await expect(page.locator('[data-testid="apps-list-title"]')).toBeVisible({ timeout: 15_000 });
  await expectNoInternalLanguage(page, '/apps');

  await page.goto('/settings');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await expect(page.locator('[data-testid="apps-sidebar"]')).toBeVisible({ timeout: 15_000 });
  await expectNoInternalLanguage(page, '/settings');

  await page.goto('/apps');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await page.locator('[data-testid="create-new-app-card"]').click();
  await expect(page.locator('[data-testid="template-picker-overlay"]')).toBeVisible({ timeout: 5_000 });
  await expectNoInternalLanguage(page, 'template picker');

  await page.locator('[data-testid="template-starter-app-btn"]').click();
  await page.waitForURL(/\/app\/[a-zA-Z0-9-]+\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByTestId('page-app-dashboard')).toBeVisible({ timeout: 15_000 });
  await expectNoInternalLanguage(page, '/app/:id/dashboard');
});
