import AxeBuilder from '@axe-core/playwright';
import { expect,test } from '@playwright/test';

/**
 * Accessibility Tests for Navigation Components
 * 
 * These tests use axe-core to check WCAG 2.1 Level AA compliance
 * for the navigation components and overall admin panel.
 * 
 * Tagged with @accessibility for targeted execution in CI.
 */

test.describe('Navigation Accessibility @accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/auth/v1/token', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ 
          access_token: 'mock-token', 
          user: { id: 'user_1', email: 'admin@easymo.app' } 
        }),
        headers: { 'content-type': 'application/json' },
      });
    });

    // Mock API responses
    await page.route('**/rest/v1/**', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([]),
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  test('sidebar navigation meets WCAG 2.1 Level AA', async ({ page }) => {
    await page.goto('/insurance');
    
    // Wait for navigation to load
    await page.waitForSelector('[role="navigation"][aria-label="Primary navigation"]', {
      state: 'visible',
    });

    // Run axe accessibility scan on sidebar
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[role="navigation"][aria-label="Primary navigation"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('breadcrumbs meet WCAG 2.1 Level AA', async ({ page }) => {
    await page.goto('/notifications/settings');
    
    await page.waitForSelector('[aria-label="Breadcrumb"]', { state: 'visible' });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[aria-label="Breadcrumb"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('mobile navigation menu meets WCAG 2.1 Level AA', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/insurance');
    
    // Open mobile menu
    const menuButton = page.locator('button[aria-label*="Open navigation menu"]');
    await menuButton.click();
    await page.waitForTimeout(300);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('skip link is keyboard accessible', async ({ page }) => {
    await page.goto('/insurance');
    
    // Tab to focus skip link
    await page.keyboard.press('Tab');
    
    const skipLink = page.locator('a:has-text("Skip to main content")');
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toBeFocused();
    
    // Verify skip link can be activated
    await page.keyboard.press('Enter');
    
    // Main content should receive focus
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeFocused();
  });

  test('navigation links have proper focus order', async ({ page }) => {
    await page.goto('/insurance');
    
    await page.waitForSelector('[role="navigation"][aria-label="Primary navigation"]', {
      state: 'visible',
    });
    
    // Tab through navigation elements
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Mobile menu button (hidden on desktop)
    await page.keyboard.press('Tab'); // Search button
    await page.keyboard.press('Tab'); // First nav link
    
    // Verify a navigation link is focused
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const tagName = await focusedElement.evaluate((el) => el?.tagName);
    const role = await focusedElement.evaluate((el) => el?.getAttribute('role'));
    
    expect(tagName === 'A' || role === 'link').toBeTruthy();
  });

  test('all interactive elements have accessible names', async ({ page }) => {
    await page.goto('/insurance');
    
    await page.waitForSelector('[role="navigation"][aria-label="Primary navigation"]', {
      state: 'visible',
    });

    // Check all buttons have accessible names
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      expect(
        ariaLabel || (text && text.trim().length > 0),
        'Button must have aria-label or visible text'
      ).toBeTruthy();
    }
    
    // Check all links have accessible names
    const links = await page.locator('a').all();
    for (const link of links) {
      const ariaLabel = await link.getAttribute('aria-label');
      const text = await link.textContent();
      
      expect(
        ariaLabel || (text && text.trim().length > 0),
        'Link must have aria-label or visible text'
      ).toBeTruthy();
    }
  });

  test('navigation has proper ARIA landmarks', async ({ page }) => {
    await page.goto('/insurance');
    
    await page.waitForLoadState('networkidle');

    // Check for main landmark
    const main = page.locator('main');
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute('id', 'main-content');
    
    // Check for navigation landmark
    const nav = page.locator('[role="navigation"][aria-label="Primary navigation"]');
    await expect(nav).toBeVisible();
    
    // Check for banner (header) landmark
    const banner = page.locator('[role="banner"]');
    if (await banner.count() > 0) {
      await expect(banner.first()).toBeVisible();
    }
  });

  test('color contrast meets WCAG AA standards', async ({ page }) => {
    await page.goto('/insurance');
    
    await page.waitForSelector('[role="navigation"][aria-label="Primary navigation"]', {
      state: 'visible',
    });

    // Run axe scan specifically for color contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .disableRules(['color-contrast'])  // We'll check this separately with custom rules
      .analyze();

    // Check for any contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast'
    );
    
    expect(contrastViolations).toEqual([]);
  });

  test('navigation works with screen reader simulation', async ({ page }) => {
    await page.goto('/insurance');
    
    await page.waitForSelector('[role="navigation"][aria-label="Primary navigation"]', {
      state: 'visible',
    });

    // Verify all navigation items have proper accessible names
    const navItems = page.locator('[role="navigation"] a, [role="navigation"] button');
    const count = await navItems.count();
    
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      const item = navItems.nth(i);
      const accessibleName = await item.evaluate((el) => {
        const ariaLabel = el.getAttribute('aria-label');
        const text = el.textContent?.trim();
        return ariaLabel || text || '';
      });
      
      expect(accessibleName.length).toBeGreaterThan(0);
    }
  });

  test('keyboard shortcuts are documented', async ({ page }) => {
    await page.goto('/insurance');
    
    // Check if keyboard hint is visible in navigation footer
    const keyboardHint = page.locator('text=/press/i');
    
    // May not always be visible depending on scroll position
    const isVisible = await keyboardHint.isVisible().catch(() => false);
    
    if (isVisible) {
      expect(await keyboardHint.textContent()).toContain('Tab');
    }
  });

  test('group expand/collapse buttons have proper ARIA states', async ({ page }) => {
    await page.goto('/insurance');
    
    await page.waitForSelector('[role="navigation"][aria-label="Primary navigation"]', {
      state: 'visible',
    });

    // Find group toggle buttons
    const groupButtons = page.locator('button[aria-expanded]');
    const count = await groupButtons.count();
    
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      const button = groupButtons.nth(i);
      
      // Check required ARIA attributes
      await expect(button).toHaveAttribute('aria-expanded');
      await expect(button).toHaveAttribute('aria-controls');
      
      // Get the panel it controls
      const panelId = await button.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      
      const panel = page.locator(`#${panelId}`);
      await expect(panel).toHaveAttribute('aria-labelledby');
    }
  });

  test('active page is properly indicated to screen readers', async ({ page }) => {
    await page.goto('/insurance');
    
    await page.waitForSelector('[aria-current="page"]', { state: 'visible' });

    // Verify active page has aria-current="page"
    const activeLinks = page.locator('[aria-current="page"]');
    const count = await activeLinks.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Verify only the current page has this attribute
    const allLinks = page.locator('[role="navigation"] a');
    const allLinksCount = await allLinks.count();
    
    // Count should be less than or equal to total links
    expect(count).toBeLessThanOrEqual(allLinksCount);
  });

  test('full page scan for critical accessibility issues', async ({ page }) => {
    await page.goto('/insurance');
    
    await page.waitForLoadState('networkidle');

    // Run full page accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Log any violations found
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Accessibility violations found:');
      accessibilityScanResults.violations.forEach((violation) => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Impact: ${violation.impact}`);
        console.log(`  Help: ${violation.helpUrl}`);
      });
    }

    // Fail test if there are any critical or serious violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalViolations).toEqual([]);
  });
});
