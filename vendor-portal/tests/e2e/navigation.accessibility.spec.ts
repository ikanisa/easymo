// @ts-nocheck

import { test, expect } from "@playwright/test";
import { setSession } from "./support/session";

test.describe("navigation accessibility", () => {
  test("quick actions trap focus and close on Escape", async ({ page, request }) => {
    await setSession(request, page, "authenticated");
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/dashboard");

    const trigger = page.locator('button[aria-controls="quick-actions"]');
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.locator("#quick-actions");
    await expect(dialog).toBeVisible();

    const focusable = dialog.locator("[data-quick-focus]");
    await expect(focusable.first()).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(focusable.last()).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(focusable.first()).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
