/**
 * PROD HEALTH — minimal smoke (PLANET-1438)
 * Runs every 30 min via prod-health.yml.
 * Login → /apps loads → click "Create new app" → picker visible.
 * Does NOT create a real app.
 */
import { test, expect } from '../fixtures/auth';

test('prod-health: login + apps + create picker', async ({ authedPage: page }) => {
  // /apps should load
  await page.goto('/apps');
  await expect(page.locator('h1, [data-testid="apps-heading"]')).toBeVisible({ timeout: 15_000 });

  // Click create new app button
  const createBtn = page.getByRole('button', { name: /create/i }).or(page.getByText(/create new app/i));
  await createBtn.first().click();

  // Template picker should appear
  await expect(page.getByText(/starter/i).or(page.getByText(/template/i))).toBeVisible({ timeout: 10_000 });
});
