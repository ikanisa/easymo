import { expect,test } from '@playwright/test';

/**
 * Visual Regression Tests for Navigation Components
 * 
 * These tests capture screenshots of navigation UI states and compare them
 * against baselines to detect unintended visual changes.
 */

test.describe('Navigation Visual Regression', () => {
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

    // Mock API responses for navigation data
    await page.route('**/rest/v1/**', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([]),
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('sidebar default state (desktop)', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      // Wait for navigation to be visible
      await page.waitForSelector('[role="navigation"][aria-label="Primary navigation"]', {
        state: 'visible',
      });
      
      // Capture sidebar screenshot
      const sidebar = page.locator('[role="navigation"][aria-label="Primary navigation"]');
      await expect(sidebar).toHaveScreenshot('sidebar-default-desktop.png', {
        maxDiffPixels: 100,
      });
    });

    test('sidebar with active root link', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      await page.waitForSelector('[aria-current="page"]', { state: 'visible' });
      
      const sidebar = page.locator('[role="navigation"][aria-label="Primary navigation"]');
      await expect(sidebar).toHaveScreenshot('sidebar-active-root.png', {
        maxDiffPixels: 100,
      });
    });

    test('sidebar with active nested link', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/notifications');
      
      await page.waitForSelector('[aria-current="page"]', { state: 'visible' });
      
      const sidebar = page.locator('[role="navigation"][aria-label="Primary navigation"]');
      await expect(sidebar).toHaveScreenshot('sidebar-active-nested.png', {
        maxDiffPixels: 100,
      });
    });

    test('sidebar with collapsed group', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      // Wait for and collapse a group
      const groupButton = page.locator('button[aria-label*="section"]').first();
      await groupButton.click();
      await page.waitForTimeout(300); // Wait for animation
      
      const sidebar = page.locator('[role="navigation"][aria-label="Primary navigation"]');
      await expect(sidebar).toHaveScreenshot('sidebar-collapsed-group.png', {
        maxDiffPixels: 100,
      });
    });

    test('sidebar hover state', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      // Hover over a link
      const link = page.locator('[role="link"]').first();
      await link.hover();
      await page.waitForTimeout(100); // Wait for hover effect
      
      const sidebar = page.locator('[role="navigation"][aria-label="Primary navigation"]');
      await expect(sidebar).toHaveScreenshot('sidebar-link-hover.png', {
        maxDiffPixels: 100,
      });
    });

    test('sidebar focus state (keyboard navigation)', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      // Tab to focus on navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      const sidebar = page.locator('[role="navigation"][aria-label="Primary navigation"]');
      await expect(sidebar).toHaveScreenshot('sidebar-keyboard-focus.png', {
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('Mobile Navigation', () => {
    test('mobile menu closed state', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/insurance');
      
      await page.waitForSelector('button[aria-label*="navigation menu"]', {
        state: 'visible',
      });
      
      await expect(page).toHaveScreenshot('mobile-menu-closed.png', {
        fullPage: false,
        maxDiffPixels: 100,
      });
    });

    test('mobile menu open state', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/insurance');
      
      // Open mobile menu
      const menuButton = page.locator('button[aria-label*="Open navigation menu"]');
      await menuButton.click();
      await page.waitForTimeout(300); // Wait for animation
      
      await expect(page).toHaveScreenshot('mobile-menu-open.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('mobile menu with overlay', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/insurance');
      
      const menuButton = page.locator('button[aria-label*="Open navigation menu"]');
      await menuButton.click();
      await page.waitForTimeout(300);
      
      // Check overlay is visible
      const overlay = page.locator('.bg-black\\/50');
      await expect(overlay).toBeVisible();
      
      await expect(page).toHaveScreenshot('mobile-menu-overlay.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('Breadcrumbs', () => {
    test('breadcrumbs on root page', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      await page.waitForSelector('[aria-label="Breadcrumb"]', { state: 'visible' });
      
      const breadcrumbs = page.locator('[aria-label="Breadcrumb"]');
      await expect(breadcrumbs).toHaveScreenshot('breadcrumbs-root.png', {
        maxDiffPixels: 50,
      });
    });

    test('breadcrumbs on nested page', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/notifications/settings');
      
      await page.waitForSelector('[aria-label="Breadcrumb"]', { state: 'visible' });
      
      const breadcrumbs = page.locator('[aria-label="Breadcrumb"]');
      await expect(breadcrumbs).toHaveScreenshot('breadcrumbs-nested.png', {
        maxDiffPixels: 50,
      });
    });

    test('breadcrumbs hover state', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/notifications/settings');
      
      await page.waitForSelector('[aria-label="Breadcrumb"]', { state: 'visible' });
      
      // Hover over breadcrumb link
      const link = page.locator('[aria-label="Breadcrumb"] a').first();
      await link.hover();
      await page.waitForTimeout(100);
      
      const breadcrumbs = page.locator('[aria-label="Breadcrumb"]');
      await expect(breadcrumbs).toHaveScreenshot('breadcrumbs-hover.png', {
        maxDiffPixels: 50,
      });
    });
  });

  test.describe('Search Integration', () => {
    test('search button in navigation', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      const searchButton = page.locator('button[aria-label="Open search"]');
      await expect(searchButton).toBeVisible();
      
      await expect(searchButton).toHaveScreenshot('search-button.png', {
        maxDiffPixels: 50,
      });
    });

    test('search button hover state', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      const searchButton = page.locator('button[aria-label="Open search"]');
      await searchButton.hover();
      await page.waitForTimeout(100);
      
      await expect(searchButton).toHaveScreenshot('search-button-hover.png', {
        maxDiffPixels: 50,
      });
    });
  });

  test.describe('Responsive Breakpoints', () => {
    const breakpoints = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'wide', width: 1920, height: 1080 },
    ];

    for (const breakpoint of breakpoints) {
      test(`navigation at ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`, async ({ page }) => {
        await page.setViewportSize({ 
          width: breakpoint.width, 
          height: breakpoint.height 
        });
        await page.goto('/insurance');
        
        // Wait for content to load
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot(`nav-${breakpoint.name}.png`, {
          fullPage: false,
          maxDiffPixels: 200,
        });
      });
    }
  });

  test.describe('Dark Mode (Future)', () => {
    test.skip('sidebar in dark mode', async ({ page }) => {
      // Placeholder for future dark mode support
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      const sidebar = page.locator('[role="navigation"][aria-label="Primary navigation"]');
      await expect(sidebar).toHaveScreenshot('sidebar-dark-mode.png', {
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('Accessibility Indicators', () => {
    test('skip link visibility on focus', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      // Tab to focus skip link
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      const skipLink = page.locator('a:has-text("Skip to main content")');
      await expect(skipLink).toBeVisible();
      
      await expect(page).toHaveScreenshot('skip-link-focused.png', {
        fullPage: false,
        maxDiffPixels: 100,
      });
    });

    test('active indicator dot on current page', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/notifications');
      
      await page.waitForSelector('[aria-current="page"]', { state: 'visible' });
      
      const activeLink = page.locator('[aria-current="page"]');
      await expect(activeLink).toHaveScreenshot('active-indicator-dot.png', {
        maxDiffPixels: 50,
      });
    });

    test('keyboard navigation hint in footer', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/insurance');
      
      const footer = page.locator('.border-t.border-gray-200').last();
      await expect(footer).toHaveScreenshot('keyboard-hint-footer.png', {
        maxDiffPixels: 50,
      });
    });
  });
});
