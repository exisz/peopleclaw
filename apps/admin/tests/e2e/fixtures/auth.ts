import { test as base, expect, type Page } from '@playwright/test';

const USERNAME = process.env.E2E_USERNAME ?? 'demo_acceptance_test';
const PASSWORD = process.env.E2E_PASSWORD ?? 'DemoAccept2026!';

/**
 * Sign in via Logto username/password flow.
 * After sign-in, lands on /app.
 */
export async function signIn(page: Page) {
  await page.goto('/');
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

  // Back in app
  await page.waitForURL(/\/app/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
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
