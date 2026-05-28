import { test, expect } from './fixtures/auth';

test.describe('Workflow editor smoke', () => {
  test('opens editor for shopify-product-listing-demo and shows save indicator', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.waitForURL(/\/workflows/);

    // Click the demo workflow (text match — stable enough as seed name)
    const demo = authedPage.getByText(/shopify-product-listing-demo/i).first();
    await expect(demo).toBeVisible({ timeout: 15_000 });
    await demo.click();

    // Editor mounts — properties tab + save indicator are reliable testids
    await expect(authedPage.getByTestId('tab-properties')).toBeVisible({ timeout: 15_000 });
    // Save indicator can be in any state — assert any of the variants exists
    const saveIndicator = authedPage.locator('[data-testid^="save-indicator-"]');
    await expect(saveIndicator.first()).toBeVisible();
  });

  test('shortcut help dialog opens via help icon (PLANET-928)', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.getByText(/shopify-product-listing-demo/i).first().click();
    await expect(authedPage.getByTestId('shortcut-help-button')).toBeVisible({ timeout: 15_000 });
    await authedPage.getByTestId('shortcut-help-button').click();
    await expect(authedPage.getByTestId('shortcut-help-overlay')).toBeVisible();
    await authedPage.keyboard.press('Escape');
    await expect(authedPage.getByTestId('shortcut-help-overlay')).not.toBeVisible();
  });
});

/**
 * PLANET-1049: Workflow save boundary cases.
 * Creates a workflow with various name types, adds a step, and verifies
 * the save indicator reaches "saved" state (no regress of empty-slug bug).
 */
test.describe('PLANET-1049 workflow save boundary cases', () => {
  const BOUNDARY_NAMES = [
    '测试工作流',              // pure CJK
    'test 测试 mix',           // mixed ASCII + CJK
    '🚀工作流',                // leading emoji
    '123456',                  // all digits
    'a',                       // single char
    'test/流?<>',              // special chars
    'x'.repeat(205),           // over 200 chars (slugified to ≤60)
  ];

  for (const name of BOUNDARY_NAMES) {
    test(`creates and saves workflow: "${name.slice(0, 30)}"`, async ({ authedPage }) => {
      await authedPage.getByTestId('nav-workflows').click();
      await authedPage.waitForURL(/\/workflows/, { timeout: 15_000 });

      // Open create dialog — try the top-bar "New" button first, fall back to other
      const createBtn = authedPage.getByTestId('create-workflow-btn').first();
      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await createBtn.click();
      } else {
        await authedPage.getByRole('button', { name: /new|create/i }).first().click();
      }

      // Fill name
      const nameInput = authedPage.getByRole('textbox').last();
      await nameInput.fill(name);
      await authedPage.getByRole('button', { name: /create|ok|submit|确认/i }).last().click();

      // Editor should load and show breadcrumb with the workflow name
      const breadcrumb = authedPage.getByTestId('workflow-breadcrumb-name');
      await expect(breadcrumb).toBeVisible({ timeout: 15_000 });
      // Name in breadcrumb should not be empty
      const breadcrumbText = await breadcrumb.textContent();
      expect(breadcrumbText?.trim().length).toBeGreaterThan(0);

      // Add a step via sidebar (switch to Step Library tab)
      const libraryTab = authedPage.getByTestId('sidebar-tab-library');
      if (await libraryTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await libraryTab.click();
        const firstTemplate = authedPage.locator('[data-step-template]').first();
        if (await firstTemplate.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await firstTemplate.click();
        }
      }

      // Wait up to 3s for debounced save to fire
      await authedPage.waitForTimeout(3_500);

      // Save indicator must reach "saved" (not stay "dirty" = 409/5xx)
      await expect(authedPage.getByTestId('save-indicator-saved')).toBeVisible({ timeout: 8_000 });
    });
  }

  test('empty name is blocked by dialog (not sent to server)', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.waitForURL(/\/workflows/, { timeout: 15_000 });
    const createBtn = authedPage.getByTestId('create-workflow-btn').first();
    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createBtn.click();
    } else {
      await authedPage.getByRole('button', { name: /new|create/i }).first().click();
    }
    // Submit with empty name
    const nameInput = authedPage.getByRole('textbox').last();
    await nameInput.fill('');
    await authedPage.getByRole('button', { name: /create|ok|submit|确认/i }).last().click();
    // Dialog must stay open (no navigation)
    await authedPage.waitForTimeout(500);
    await expect(nameInput).toBeVisible();
  });
});

/**
 * PLANET-1050: Navigation and workflow list.
 */
test.describe('PLANET-1050 workflow navigation', () => {
  test('top navigation bar is visible in workflow editor', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.waitForURL(/\/workflows/, { timeout: 15_000 });
    await expect(authedPage.getByTestId('app-topbar')).toBeVisible({ timeout: 10_000 });
    await expect(authedPage.getByTestId('nav-dashboard')).toBeVisible();
    await expect(authedPage.getByTestId('nav-workflows')).toBeVisible();
    await expect(authedPage.getByTestId('nav-cases')).toBeVisible();
  });

  test('workflow name appears in breadcrumb', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.waitForURL(/\/workflows/, { timeout: 15_000 });
    // Wait for sidebar workflow list to load
    const anyWorkflow = authedPage.locator('[data-testid^="sidebar-workflow-"]').first();
    if (await anyWorkflow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await anyWorkflow.click();
    }
    const breadcrumb = authedPage.getByTestId('workflow-breadcrumb-name');
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });
    const text = await breadcrumb.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('dashboard shows my workflows list', async ({ authedPage }) => {
    await authedPage.goto('/dashboard');
    await authedPage.waitForURL(/\/dashboard/, { timeout: 15_000 });
    // The "My Workflows" card should render
    await expect(authedPage.getByText(/My Workflows/i)).toBeVisible({ timeout: 10_000 });
    // Link to /workflows should be present
    const wfLink = authedPage.getByTestId('nav-workflows');
    await expect(wfLink).toBeVisible();
  });
});

/**
 * PLANET-1048: AI image generation node in Step Library.
 */
test.describe('PLANET-1048 AI image generation node', () => {
  test('AI image generate node visible in Step Library under AI category', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.waitForURL(/\/workflows/, { timeout: 15_000 });
    // Switch to Step Library
    const libraryTab = authedPage.getByTestId('sidebar-tab-library');
    await expect(libraryTab).toBeVisible({ timeout: 10_000 });
    await libraryTab.click();
    // AI category header
    await expect(authedPage.getByTestId('step-library-cat-ai')).toBeVisible({ timeout: 10_000 });
    // The node entry
    await expect(authedPage.getByTestId('step-template-ai.image_generate')).toBeVisible({ timeout: 10_000 });
  });

  test('AI image generate node can be added to canvas', async ({ authedPage }) => {
    await authedPage.getByTestId('nav-workflows').click();
    await authedPage.waitForURL(/\/workflows/, { timeout: 15_000 });

    // Create a fresh workflow for this test
    const createBtn = authedPage.getByTestId('create-workflow-btn').first();
    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) await createBtn.click();
    else await authedPage.getByRole('button', { name: /new|create/i }).first().click();
    const nameInput = authedPage.getByRole('textbox').last();
    await nameInput.fill('e2e-ai-image-test-' + Date.now());
    await authedPage.getByRole('button', { name: /create|ok|submit|确认/i }).last().click();
    await expect(authedPage.getByTestId('workflow-breadcrumb-name')).toBeVisible({ timeout: 15_000 });

    // Switch to Step Library, click AI image generate
    const libraryTab = authedPage.getByTestId('sidebar-tab-library');
    await libraryTab.click();
    await expect(authedPage.getByTestId('step-template-ai.image_generate')).toBeVisible({ timeout: 10_000 });
    await authedPage.getByTestId('step-template-ai.image_generate').click();

    // Step should be added and save should settle
    await authedPage.waitForTimeout(3_500);
    await expect(authedPage.getByTestId('save-indicator-saved')).toBeVisible({ timeout: 8_000 });
  });
});
