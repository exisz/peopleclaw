import { test, expect } from './fixtures/auth';

test.use({ viewport: { width: 1440, height: 900 } });

test('PLANET-1213: DOM inspection - what does Elen actually see', async ({ authedPage: page }) => {
  await page.goto('/workflows');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check the ... menu button opacity/visibility WITHOUT hover
  const menuBtn = page.locator('[data-testid^="sidebar-workflow-menu-"]').first();
  const btnCount = await page.locator('[data-testid^="sidebar-workflow-menu-"]').count();
  console.log('Menu button count:', btnCount);
  
  if (btnCount > 0) {
    const opacity = await menuBtn.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        opacity: style.opacity,
        visibility: style.visibility,
        display: style.display,
        className: el.className
      };
    });
    console.log('Menu button computed style (no hover):', JSON.stringify(opacity));
  }
  
  // Check topbar buttons
  const topbarButtons = await page.locator('[data-testid="app-topbar"] button, [data-testid="app-topbar"] a').allTextContents();
  console.log('Topbar buttons:', topbarButtons);
  
  // Check delete button
  const deleteBtn = page.locator('[data-testid="topbar-delete-workflow-btn"]');
  const deleteExists = await deleteBtn.count();
  console.log('Delete button count:', deleteExists);
  if (deleteExists > 0) {
    const deleteInfo = await deleteBtn.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        opacity: style.opacity,
        visibility: style.visibility,
        disabled: (el as HTMLButtonElement).disabled,
        text: el.textContent,
        className: el.className
      };
    });
    console.log('Delete button state (no workflow selected):', JSON.stringify(deleteInfo));
  }
  
  // Now select a workflow
  const firstWorkflow = page.locator('[data-testid^="sidebar-workflow-"]').first();
  await firstWorkflow.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  
  const deleteBtn2 = page.locator('[data-testid="topbar-delete-workflow-btn"]');
  if (await deleteBtn2.count() > 0) {
    const deleteInfo2 = await deleteBtn2.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        opacity: style.opacity,
        visibility: style.visibility,
        disabled: (el as HTMLButtonElement).disabled,
        text: el.textContent,
        className: el.className
      };
    });
    console.log('Delete button state (workflow selected):', JSON.stringify(deleteInfo2));
  }
  
  // Check if this workflow is a system workflow
  const isSystemWorkflow = await page.locator('[data-testid="topbar-delete-workflow-btn"]').count();
  const cloneBtn = await page.locator('[data-testid="topbar-clone-workflow-btn"]').count();
  console.log('Delete button after selection:', isSystemWorkflow, 'Clone button:', cloneBtn);
  
  // List all workflows and check which are system
  const workflows = await page.evaluate(() => {
    // Try to get from the DOM - find all sidebar items
    const items = document.querySelectorAll('[data-testid^="sidebar-workflow-"]');
    return Array.from(items).map(el => ({
      testId: el.getAttribute('data-testid'),
      text: el.textContent?.trim().substring(0, 50)
    }));
  });
  console.log('Sidebar workflows:', JSON.stringify(workflows));
});
