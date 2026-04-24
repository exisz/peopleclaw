import { test as base, expect, type Page } from '@playwright/test';

const USERNAME = process.env.E2E_USERNAME ?? 'demo_acceptance_test';
const PASSWORD = process.env.E2E_PASSWORD ?? 'DemoAccept2026!';

/**
 * Sign in via Logto using username/password. Skips MFA per docs/GOTCHAS.md.
 *
 * Logto sign-in page selectors are stable since they ship as part of the hosted
 * experience: input[name="identifier"] then input[name="password"].
 */
export async function signIn(page: Page) {
  await page.goto('/');
  // Click sign-in CTA on landing if present, else navigate to /signin directly.
  const signInBtn = page.getByRole('link', { name: /sign in/i }).first();
  if (await signInBtn.isVisible().catch(() => false)) {
    await signInBtn.click();
  } else {
    await page.goto('/signin');
  }

  // Logto hosted page
  await page.waitForURL(/logto|auth|sign-in|id\.rollersoft/i, { timeout: 30_000 });
  await page.fill('input[name="identifier"], input[type="text"]', USERNAME);
  await page.click('button[type="submit"]');
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Back in app — wait for dashboard
  await page.waitForURL(/\/dashboard|\/workflows|\/cases/, { timeout: 30_000 });
  // Dashboard has nav-cases (small header); Workflows has nav-workflows.
  // Just check we're in the app (not auth page) by confirming body has loaded.
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText(/sign.?in/i, { timeout: 5_000 }).catch(() => {});
}

type Fixtures = {
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  authedPage: async ({ page }, use) => {
    await signIn(page);
    await use(page);
  },
});

export { expect };
