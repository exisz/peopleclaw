/**
 * SMOKE DISCOVERY TEST — 全链路 console-error 抓取 (PLANET-1433)
 *
 * Goal: Visit every route, interact with every major UI element,
 * collect ALL errors (console errors, page errors, failed requests, 4xx/5xx),
 * and report them at the end in one assertion.
 *
 * This test does NOT fail on individual errors — it collects everything
 * and reports the full list at the end.
 */
import { test, expect } from '../fixtures/auth';
import { type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CollectedError {
  type: 'pageerror' | 'console-error' | 'console-warning' | 'http-error' | 'request-failed';
  url: string;
  step: string;
  message: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const IGNORED_CONSOLE = [
  /\[vite\]/i,
  /hmr/i,
  /source.?map/i,
  /DevTools/i,
  /Download the React DevTools/i,
  /Third-party cookie/i,
  /Autofocus processing/i,
];

const IGNORED_URLS = [
  /favicon/i,
  /analytics/i,
  /google/i,
  /hotjar/i,
  /sentry/i,
  /logto/i, // auth provider noise
];

function shouldIgnoreConsole(text: string): boolean {
  return IGNORED_CONSOLE.some((re) => re.test(text));
}

function shouldIgnoreUrl(url: string): boolean {
  return IGNORED_URLS.some((re) => re.test(url));
}

function isSameSite(reqUrl: string, baseUrl: string): boolean {
  try {
    const req = new URL(reqUrl);
    const base = new URL(baseUrl);
    return req.hostname === base.hostname || req.hostname.endsWith(`.${base.hostname}`);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
test.describe('99-smoke-everything: Full discovery', () => {
  test('全链路 smoke — collect all errors', async ({ authedPage }) => {
    const page = authedPage;
    test.setTimeout(300_000); // 5 min max

    const errors: CollectedError[] = [];
    let currentStep = 'init';
    const baseUrl = page.url();

    // --- Global listeners ---
    page.on('pageerror', (err) => {
      errors.push({
        type: 'pageerror',
        url: page.url(),
        step: currentStep,
        message: err.message,
        timestamp: Date.now(),
      });
    });

    page.on('console', (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warning') return;
      const text = msg.text();
      if (shouldIgnoreConsole(text)) return;
      errors.push({
        type: type === 'error' ? 'console-error' : 'console-warning',
        url: page.url(),
        step: currentStep,
        message: text.slice(0, 500),
        timestamp: Date.now(),
      });
    });

    page.on('response', (response) => {
      if (response.status() < 400) return;
      const url = response.url();
      if (!isSameSite(url, baseUrl)) return;
      if (shouldIgnoreUrl(url)) return;
      errors.push({
        type: 'http-error',
        url,
        step: currentStep,
        message: `HTTP ${response.status()} ${response.statusText()}`,
        timestamp: Date.now(),
      });
    });

    page.on('requestfailed', (request) => {
      const url = request.url();
      if (!isSameSite(url, baseUrl)) return;
      if (shouldIgnoreUrl(url)) return;
      errors.push({
        type: 'request-failed',
        url,
        step: currentStep,
        message: request.failure()?.errorText ?? 'unknown',
        timestamp: Date.now(),
      });
    });

    // --- Helper: safe navigation ---
    async function safeGoto(path: string, stepName: string) {
      currentStep = stepName;
      await page.goto(path, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    async function safeClick(locator: ReturnType<Page['locator']>, stepName: string, timeout = 5_000) {
      currentStep = stepName;
      try {
        await locator.click({ timeout });
        await page.waitForTimeout(800);
      } catch {
        // element not found — skip
      }
    }

    // =======================================================================
    // PHASE 1: Route coverage (sidebar nav)
    // =======================================================================

    // /apps
    await safeGoto('/apps', 'nav → /apps');
    const sidebar = page.locator('[data-testid="apps-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10_000 }).catch(() => {});

    // /published
    await safeClick(sidebar.getByText('Published'), 'nav → /published');
    await page.waitForTimeout(1000);

    // /security
    await safeClick(sidebar.getByText('Security'), 'nav → /security');
    await page.waitForTimeout(1000);

    // /settings
    await safeClick(sidebar.getByText('Settings'), 'nav → /settings');
    await page.waitForTimeout(1000);

    // /settings sub-pages
    for (const sub of ['Team', 'Billing', 'Connections']) {
      await safeClick(page.getByRole('link', { name: sub }).or(page.getByText(sub, { exact: true })), `nav → /settings/${sub.toLowerCase()}`);
      await page.waitForTimeout(800);
    }

    // Back to apps
    await safeClick(sidebar.getByText('Apps'), 'nav → /apps (back)');
    await page.waitForTimeout(1000);

    // =======================================================================
    // PHASE 2: App lifecycle — create starter-app
    // =======================================================================
    currentStep = 'create starter-app';
    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {});

    // Click create
    await safeClick(page.locator('[data-testid="create-new-app-card"]'), 'click create-new-app-card');

    // Pick template
    const picker = page.locator('[data-testid="template-picker-overlay"]');
    await picker.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await safeClick(page.locator('[data-testid="template-starter-app-btn"]'), 'pick starter-app template');

    // Wait for /app/:id
    await page.waitForURL(/\/app\/[a-zA-Z0-9-]+/, { timeout: 30_000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    // =======================================================================
    // PHASE 3: App interactions — nodes, tabs, run, chat, drag
    // =======================================================================

    const canvas = page.locator('[data-testid="canvas-pane"]');
    await canvas.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

    // Click each node type
    for (const nodeType of ['BACKEND', 'FRONTEND', 'FULLSTACK']) {
      currentStep = `click node ${nodeType}`;
      const node = page.locator(`[data-testid="canvas-node-${nodeType}"]`);
      await safeClick(node, `click node ${nodeType}`, 10_000);

      // Try switching tabs in detail panel
      for (const tabTid of ['detail-sub-tab-flow', 'detail-sub-tab-run']) {
        await safeClick(page.locator(`[data-testid="${tabTid}"]`), `${nodeType} → tab ${tabTid}`);
      }
    }

    // Run backend node
    currentStep = 'run BACKEND';
    await safeClick(page.locator('[data-testid="canvas-node-BACKEND"]'), 'select BACKEND for run', 10_000);
    await safeClick(page.locator('[data-testid="detail-run-btn"]'), 'click Run btn');
    // Wait for status change (done or error) — up to 45s
    await page.waitForTimeout(5_000);
    const statusDone = page.locator('[data-testid*="status-done"], [data-testid*="status-error"]');
    await statusDone.first().waitFor({ state: 'visible', timeout: 45_000 }).catch(() => {});

    // Chat panel — send "hello"
    // PLANET-1407: Chat is its own page under the Living SaaS shell. Navigate to it.
    currentStep = 'chat → hello';
    const appUrlMatch = page.url().match(/\/app\/([^/]+)/);
    if (appUrlMatch) {
      await page.goto(`/app/${appUrlMatch[1]}/chat`, { waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {});
    }
    const chatInput = page.locator('[data-testid="chat-input"]');
    if (await chatInput.isVisible().catch(() => false)) {
      await chatInput.fill('hello');
      await safeClick(page.locator('[data-testid="chat-send-btn"]'), 'chat send');
      // Wait for LLM response
      await page.waitForTimeout(10_000);
    }

    // Canvas drag (move FRONTEND node slightly)
    currentStep = 'canvas drag';
    if (appUrlMatch) {
      await page.goto(`/app/${appUrlMatch[1]}/canvas`, { waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {});
    }
    const frontendNode = page.locator('[data-testid="canvas-node-FRONTEND"]');
    if (await frontendNode.isVisible().catch(() => false)) {
      const box = await frontendNode.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    }

    // Browser back/forward
    currentStep = 'browser back/forward';
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1000);
    await page.goForward().catch(() => {});
    await page.waitForTimeout(1000);

    // =======================================================================
    // PHASE 4: Cleanup — delete the app
    // =======================================================================
    currentStep = 'cleanup — delete app';
    // Navigate back to apps list and find our app to delete (or just leave it)
    // For now, just go to /apps — deletion UI varies
    await page.goto('/apps', { waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {});

    // =======================================================================
    // REPORT
    // =======================================================================
    if (errors.length > 0) {
      // Take screenshot for context
      await page.screenshot({ path: 'test-results/99-smoke-errors.png', fullPage: true }).catch(() => {});

      // Format report
      const report = errors.map((e, i) =>
        `[${i + 1}] ${e.type} @ step "${e.step}"\n    URL: ${e.url}\n    MSG: ${e.message}`
      ).join('\n\n');

      console.log('\n===== SMOKE DISCOVERY REPORT =====\n');
      console.log(`Total issues: ${errors.length}\n`);
      console.log(report);
      console.log('\n===== END REPORT =====\n');
    }

    // Single assertion at end
    expect(errors, `Found ${errors.length} issues:\n${errors.map((e) => `[${e.type}] ${e.step}: ${e.message}`).join('\n')}`).toEqual([]);
  });
});
