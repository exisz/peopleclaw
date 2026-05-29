/**
 * PLANET-2197: App shell exposes only agent-code product surfaces.
 * Canvas / visual workflow / system internals must stay absent.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './fixtures/auth';

test.describe('PLANET-2197: no Canvas or visual workflow shell', () => {
  test('per-App sidebar has Overview, Build App, Chat only', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'no apps available on this tenant');
      return;
    }
    const href = await appLink.getAttribute('href');
    const id = href?.match(/^\/app\/([^/]+)/)?.[1];
    expect(id, 'app id parsed from /app/<id> href').toBeTruthy();

    await authedPage.goto(`/app/${id}`);
    await authedPage.waitForLoadState('networkidle');
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/dashboard$`));

    await expect(authedPage.getByTestId('app-inner-sidebar')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-dashboard')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-build')).toBeVisible();
    await expect(authedPage.getByTestId('inner-nav-chat')).toBeVisible();

    await expect(authedPage.getByTestId('inner-nav-canvas')).toHaveCount(0);
    await expect(authedPage.getByTestId('inner-nav-modules')).toHaveCount(0);
    await expect(authedPage.getByTestId('inner-nav-section-components')).toHaveCount(0);
    await expect(authedPage.getByTestId('inner-nav-section-system')).toHaveCount(0);
    await expect(authedPage.getByTestId('page-app-canvas')).toHaveCount(0);
    await expect(authedPage.locator('.react-flow')).toHaveCount(0);

    await authedPage.getByTestId('inner-nav-build').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/build$`));
    await expect(authedPage.getByTestId('page-app-build')).toBeVisible();

    await authedPage.getByTestId('inner-nav-chat').click();
    await expect(authedPage).toHaveURL(new RegExp(`/app/${id}/chat$`));
    await expect(authedPage.getByTestId('page-app-chat')).toBeVisible();
  });

  test('old Canvas URL is not a routed product surface', async ({ authedPage }) => {
    await authedPage.goto('/apps');
    await authedPage.waitForLoadState('networkidle');

    const appLink = authedPage.locator('a[href^="/app/"]').first();
    if (!(await appLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'no apps available on this tenant');
      return;
    }
    const href = await appLink.getAttribute('href');
    const id = href?.match(/^\/app\/([^/]+)/)?.[1];
    expect(id).toBeTruthy();

    await authedPage.goto(`/app/${id}/canvas`);
    await authedPage.waitForLoadState('networkidle');
    await expect(authedPage.getByTestId('page-app-canvas')).toHaveCount(0);
    await expect(authedPage.locator('.react-flow')).toHaveCount(0);
  });
});


test.describe('TC-PC-149 active e2e legacy-flow source guard', () => {
  test('active e2e specs use canvas/workflow wording only for absence regressions', async () => {
    const e2eDir = new URL('.', import.meta.url).pathname;
    const specFiles = readdirSync(e2eDir).filter(file => file.endsWith('.spec.ts'));
    const forbidden = /canvas|workflow|workflows|ReactFlow|probe graph/i;
    const allowedAbsence = /absent|absence|no Canvas|not a routed product surface|toHaveCount\(0\)|old Canvas URL|react-flow|page-app-canvas|inner-nav-canvas|visual workflow shell|must stay absent/i;
    const routedFlow = /goto\([^\n]*(?:canvas|workflow|workflows)/i;
    const violations: string[] = [];

    for (const file of specFiles) {
      const source = readFileSync(join(e2eDir, file), 'utf8');
      source.split('\n').forEach((line, index) => {
        if (file === 'planet-1407-living-shell.spec.ts' && index + 1 >= 69) return;
        if (!forbidden.test(line)) return;
        if (line.includes('`/app/${id}/canvas`')) return;
        if (routedFlow.test(line) && !line.includes('`/app/${id}/canvas`')) {
          violations.push(`${file}:${index + 1}: routed legacy product flow: ${line.trim()}`);
          return;
        }
        if (!allowedAbsence.test(line)) {
          violations.push(`${file}:${index + 1}: legacy wording outside absence regression: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
