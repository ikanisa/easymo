import { test, expect } from '@playwright/test';

const selectors = {
  emailField: 'input[name="email"]',
  passwordField: 'input[name="password"]',
  submitButton: 'button[type="submit"]',
  dashboardHeader: 'h1:has-text("Dashboard")',
  flagToggle: '[data-testid="feature-flag-toggle"]',
  newRecordButton: '[data-testid="create-record"]',
};

test.describe('Admin PWA smoke flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/v1/token', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ access_token: 'mock-token', user: { id: 'user_1' } }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/rest/v1/dashboard*', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ totalTrips: 12, activeBaskets: 3, flags: { 'deeplinks.enabled': true } }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/rest/v1/records*', (route, request) => {
      if (request.method() === 'POST') {
        route.fulfill({ status: 201, body: JSON.stringify({ id: 'rec_1' }) });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ id: 'rec_1', name: 'Sample' }]),
          headers: { 'content-type': 'application/json' },
        });
      }
    });
  });

  test('allows login and renders dashboard metrics', async ({ page }) => {
    await page.goto('/login');
    await page.fill(selectors.emailField, 'admin@easymo.app');
    await page.fill(selectors.passwordField, 'password123');
    await page.click(selectors.submitButton);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.locator(selectors.dashboardHeader)).toBeVisible();
    await expect(page.getByText('Total Trips')).toBeVisible();
  });

  test('supports CRUD operations for managed resources', async ({ page }) => {
    await page.goto('/records');
    await page.click(selectors.newRecordButton);
    await page.fill('input[name="name"]', 'Test basket');
    await page.click('button:has-text("Save")');
    await expect(page.getByText('Test basket')).toBeVisible();
    await page.click('button[aria-label="Edit Test basket"]');
    await page.fill('input[name="name"]', 'Test basket updated');
    await page.click('button:has-text("Save")');
    await expect(page.getByText('Test basket updated')).toBeVisible();
    await page.click('button[aria-label="Delete Test basket updated"]');
    await expect(page.getByText('record deleted')).toBeVisible();
  });

  test('handles offline fallback gracefully', async ({ page }) => {
    await page.route('**/rest/v1/dashboard*', (route) => route.abort());
    await page.goto('/dashboard');
    await page.context().setOffline(true);
    await expect(page.getByText('You appear to be offline')).toBeVisible();
    await page.context().setOffline(false);
  });

  test('toggles feature flags with optimistic feedback', async ({ page }) => {
    await page.goto('/settings/flags');
    await page.route('**/rest/v1/feature_flags*', (route, request) => {
      if (request.method() === 'PATCH') {
        route.fulfill({ status: 200, body: JSON.stringify({ key: 'deeplinks.enabled', value: false }) });
      } else {
        route.fulfill({ status: 200, body: JSON.stringify([{ key: 'deeplinks.enabled', value: true }]) });
      }
    });
    const toggle = page.locator(selectors.flagToggle).first();
    await toggle.click();
    await expect(page.getByText('deeplinks.enabled disabled')).toBeVisible();
  });
});
