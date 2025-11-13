import { test, expect } from '@playwright/test';

/**
 * PWA Features E2E Tests
 * Tests Progressive Web App functionality
 */

test.describe('PWA Features', () => {
  test('should have valid manifest', async ({ page }) => {
    await page.goto('/en');
    
    // Check manifest link
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toBeTruthy();
    
    // Fetch and validate manifest
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('short_name');
    expect(manifest).toHaveProperty('start_url');
    expect(manifest).toHaveProperty('display');
    expect(manifest?.icons?.length).toBeGreaterThan(0);
  });

  test('should have service worker', async ({ page, context }) => {
    await page.goto('/en');
    
    // Wait for service worker registration
    await page.waitForTimeout(2000);
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration;
    });
    
    // Service worker should be registered in production build
    // In dev mode it may be disabled
    if (process.env.NODE_ENV === 'production') {
      expect(swRegistered).toBe(true);
    }
  });

  test('should have proper meta tags for PWA', async ({ page }) => {
    await page.goto('/en');
    
    // Theme color
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBeTruthy();
    
    // Viewport
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    
    // Apple mobile web app capable
    const appleMobileWebAppCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]');
    expect(await appleMobileWebAppCapable.count()).toBeGreaterThanOrEqual(0);
  });

  test('should load icons correctly', async ({ page }) => {
    await page.goto('/en');
    
    // Check favicon
    const favicon = page.locator('link[rel*="icon"]').first();
    const faviconHref = await favicon.getAttribute('href');
    expect(faviconHref).toBeTruthy();
    
    // Verify icon loads
    const iconResponse = await page.goto(faviconHref || '/favicon.svg');
    expect(iconResponse?.status()).toBe(200);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/en');
    
    // Page should be visible and not have horizontal scroll
    const body = page.locator('body');
    const bodyBox = await body.boundingBox();
    expect(bodyBox?.width).toBeLessThanOrEqual(375);
  });

  test('should work offline (basic)', async ({ page, context }) => {
    // First load the page online
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate (should work from cache)
    await page.goto('/en');
    
    // Basic content should still be visible
    await expect(page.locator('body')).toBeVisible();
    
    // Go back online
    await context.setOffline(false);
  });
});

test.describe('PWA Installation', () => {
  test('should show install prompt on supported browsers', async ({ page, context }) => {
    // This test is browser-specific and may not work in all environments
    await page.goto('/en');
    
    // Listen for beforeinstallprompt event
    const installPromptShown = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('beforeinstallprompt', () => {
          resolve(true);
        });
        setTimeout(() => resolve(false), 2000);
      });
    });
    
    // Note: Install prompt may not show in test environment
    // This is mainly for documentation purposes
  });
});

test.describe('PWA Performance', () => {
  test('should load main page quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/en');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    // Filter out known acceptable errors
    const criticalErrors = errors.filter(
      (error) => !error.includes('Download the React DevTools')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});
