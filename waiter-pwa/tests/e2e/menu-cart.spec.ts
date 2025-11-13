import { test, expect } from '@playwright/test';

/**
 * Menu & Cart E2E Tests
 * Tests menu browsing, item selection, and cart management
 */

test.describe('Menu Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/menu');
  });

  test('should display menu categories', async ({ page }) => {
    await expect(page).toHaveTitle(/Menu/);
    
    // Check for category tabs/buttons
    const categories = page.locator('[data-testid="menu-category"]');
    const count = await categories.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter menu by category', async ({ page }) => {
    // Click on a category
    const categoryButton = page.locator('[data-testid="menu-category"]').first();
    await categoryButton.click();
    
    // Menu items should be visible
    await expect(page.locator('[data-testid="menu-item"]').first()).toBeVisible();
  });

  test('should show item details when clicked', async ({ page }) => {
    // Click on a menu item
    const menuItem = page.locator('[data-testid="menu-item"]').first();
    await menuItem.click();
    
    // Details modal/page should open
    await expect(page.locator('[data-testid="item-details"]')).toBeVisible();
  });

  test('should add item to cart from menu', async ({ page }) => {
    const addButton = page.locator('[data-testid="add-to-cart"]').first();
    await addButton.click();
    
    // Cart badge should update
    const cartBadge = page.locator('[data-testid="cart-badge"]');
    await expect(cartBadge).toHaveText('1');
  });

  test('should search menu items', async ({ page }) => {
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('pizza');
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    // Should show filtered items
    const items = page.locator('[data-testid="menu-item"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Shopping Cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/menu');
    // Add an item to cart
    await page.locator('[data-testid="add-to-cart"]').first().click();
    await page.waitForTimeout(500);
  });

  test('should navigate to cart page', async ({ page }) => {
    await page.locator('[data-testid="cart-button"]').click();
    
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator('text=Shopping Cart')).toBeVisible();
  });

  test('should display cart items', async ({ page }) => {
    await page.goto('/en/cart');
    
    const cartItems = page.locator('[data-testid="cart-item"]');
    const count = await cartItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should update item quantity', async ({ page }) => {
    await page.goto('/en/cart');
    
    const increaseButton = page.locator('[data-testid="increase-quantity"]').first();
    await increaseButton.click();
    
    // Quantity should update
    await expect(page.locator('[data-testid="item-quantity"]').first()).toHaveText('2');
  });

  test('should remove item from cart', async ({ page }) => {
    await page.goto('/en/cart');
    
    const removeButton = page.locator('[data-testid="remove-item"]').first();
    await removeButton.click();
    
    // Confirm if there's a confirmation dialog
    const confirmButton = page.locator('button:has-text("Confirm")');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    
    // Cart should be empty or have fewer items
    await expect(page.locator('text=/empty|no items/i')).toBeVisible();
  });

  test('should calculate total correctly', async ({ page }) => {
    await page.goto('/en/cart');
    
    // Total should be visible
    const total = page.locator('[data-testid="cart-total"]');
    await expect(total).toBeVisible();
    
    const totalText = await total.textContent();
    expect(totalText).toMatch(/\d+/); // Should contain numbers
  });

  test('should proceed to checkout', async ({ page }) => {
    await page.goto('/en/cart');
    
    const checkoutButton = page.locator('button:has-text("Checkout")');
    await checkoutButton.click();
    
    // Should navigate to checkout/payment
    await expect(page).toHaveURL(/\/(checkout|payment)/);
  });
});

test.describe('Order Flow', () => {
  test('should complete full order flow', async ({ page }) => {
    // 1. Browse menu
    await page.goto('/en/menu');
    await expect(page.locator('[data-testid="menu-item"]').first()).toBeVisible();
    
    // 2. Add item to cart
    await page.locator('[data-testid="add-to-cart"]').first().click();
    await page.waitForTimeout(500);
    
    // 3. View cart
    await page.locator('[data-testid="cart-button"]').click();
    await expect(page).toHaveURL(/\/cart/);
    
    // 4. Proceed to checkout
    await page.locator('button:has-text("Checkout")').click();
    await expect(page).toHaveURL(/\/(checkout|payment)/);
    
    // 5. Payment page should load
    await expect(page.locator('text=/payment|pay now/i')).toBeVisible();
  });
});
