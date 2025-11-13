import { test, expect } from '@playwright/test';

/**
 * Chat Flow E2E Tests
 * Tests the main AI chat conversation functionality
 */

test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/chat');
  });

  test('should load chat interface', async ({ page }) => {
    await expect(page).toHaveTitle(/Waiter AI/);
    await expect(page.locator('text=Chat with AI')).toBeVisible();
  });

  test('should send a message and receive response', async ({ page }) => {
    // Type a message
    const input = page.locator('textarea[placeholder*="message"]');
    await input.fill('Show me the menu');
    
    // Send message
    await page.locator('button[type="submit"]').click();
    
    // Wait for user message to appear
    await expect(page.locator('text=Show me the menu')).toBeVisible();
    
    // Wait for AI response
    await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show typing indicator during response', async ({ page }) => {
    const input = page.locator('textarea[placeholder*="message"]');
    await input.fill('Hello');
    await page.locator('button[type="submit"]').click();
    
    // Typing indicator should appear briefly
    const typingIndicator = page.locator('[data-testid="typing-indicator"]');
    // Note: May need adjustment based on actual implementation
  });

  test('should support quick actions', async ({ page }) => {
    // Check if quick action buttons exist
    const quickActions = page.locator('[data-testid="quick-action"]');
    const count = await quickActions.count();
    expect(count).toBeGreaterThan(0);
    
    // Click first quick action
    if (count > 0) {
      await quickActions.first().click();
      // Message should be sent
      await expect(page.locator('[data-role="user"]').first()).toBeVisible();
    }
  });

  test('should scroll to bottom on new messages', async ({ page }) => {
    // Send multiple messages to create scrollable content
    const input = page.locator('textarea[placeholder*="message"]');
    
    for (let i = 0; i < 3; i++) {
      await input.fill(`Message ${i + 1}`);
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(500);
    }
    
    // Last message should be visible
    await expect(page.locator('text=Message 3')).toBeVisible();
  });

  test('should persist conversation across page reloads', async ({ page }) => {
    // Send a message
    const input = page.locator('textarea[placeholder*="message"]');
    await input.fill('Test persistence');
    await page.locator('button[type="submit"]').click();
    
    await expect(page.locator('text=Test persistence')).toBeVisible();
    
    // Reload page
    await page.reload();
    
    // Message should still be visible
    await expect(page.locator('text=Test persistence')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('AI Chat - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page, context }) => {
    await page.goto('/en/chat');
    
    // Simulate offline
    await context.setOffline(true);
    
    const input = page.locator('textarea[placeholder*="message"]');
    await input.fill('Test offline');
    await page.locator('button[type="submit"]').click();
    
    // Should show error message
    await expect(page.locator('text=/error|failed|offline/i')).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await context.setOffline(false);
  });

  test('should prevent empty message submission', async ({ page }) => {
    await page.goto('/en/chat');
    
    const submitButton = page.locator('button[type="submit"]');
    
    // Button should be disabled when input is empty
    await expect(submitButton).toBeDisabled();
  });
});
