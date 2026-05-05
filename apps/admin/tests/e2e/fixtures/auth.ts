import { test as base, expect, type Page } from '@playwright/test';

const USERNAME = process.env.E2E_USERNAME ?? 'demo_acceptance_test';
const PASSWORD = process.env.E2E_PASSWORD ?? 'DemoAccept2026!';
const USE_MINT = process.env.CI === 'true' || process.env.E2E_USE_MINT === '1';
const E2E_SECRET = process.env.E2E_SECRET ?? '';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.peopleclaw.rollersoft.com.au';

/**
 * PLANET-1427: Mint a token via /api/internal/e2e-mint-session for CI.
 * Injects the access token into localStorage so the Logto browser SDK picks it up.
 */
async function signInViaMint(page: Page) {
  const res = await fetch(`${BASE_URL}/api/internal/e2e-mint-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-E2E-Secret': E2E_SECRET,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`e2e-mint-session failed (${res.status}): ${text}`);
  }

  const { accessToken, sub } = await res.json() as { accessToken: string; sub: string; expiresIn: number };

  // Navigate to app origin first so we can set localStorage
  await page.goto('/');

  // Inject token into Logto browser SDK storage format
  // @logto/browser stores in sessionStorage/localStorage with keys like:
  // `logto:${appId}:accessToken` — but the exact key depends on SDK version.
  // The safest approach: set a well-known key that our apiFetch reads,
  // OR intercept requests and inject Bearer header.
  // Using route interception for reliability:
  await page.evaluate(
    ({ token, userId }) => {
      // Store token where apiFetch can find it. The Logto SDK uses an internal
      // cache, so we override getAccessToken behavior by placing token in a
      // known location that our test fixture will read.
      (window as any).__E2E_ACCESS_TOKEN__ = token;
      (window as any).__E2E_USER_ID__ = userId;
    },
    { token: accessToken, userId: sub },
  );

  // Intercept all API requests and inject the Bearer token
  await page.route('**/api/**', async (route) => {
    const headers = {
      ...route.request().headers(),
      authorization: `Bearer ${accessToken}`,
    };
    await route.continue({ headers });
  });

  // Navigate to apps list (PLANET-1407: legacy /app dual-pane removed)
  await page.goto('/apps');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
}

/**
 * Sign in via Logto username/password flow.
 * After sign-in, lands on /apps.
 */
export async function signIn(page: Page) {
  if (USE_MINT) {
    await signInViaMint(page);
    return;
  }

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
