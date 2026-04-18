import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for PeopleClaw admin (PLANET-889).
 *
 * Default target: deployed admin at https://admin.peopleclaw.rollersoft.com.au
 * Override with PLAYWRIGHT_BASE_URL for local dev.
 *
 * Run:
 *   pnpm --filter @peopleclaw/admin exec playwright test
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm --filter @peopleclaw/admin exec playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // multi-tenant DB writes — keep serial for reliability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://admin.peopleclaw.rollersoft.com.au',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
