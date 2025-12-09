// @ts-nocheck

import { test, expect } from "@playwright/test";
import { setSession } from "./support/session";

test.describe("reconciliation network resilience", () => {
  test("shows banners when going offline and recovers gracefully", async ({ page, request }) => {
    await setSession(request, page, "authenticated");
    await page.goto("/recon");
    await page.waitForSelector("text=/Reconciliation/i");

    const banner = page.getByTestId("network-status-banner");
    await expect(banner).toBeHidden();

    await page.context().setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-state", "offline");
    const queueToggle = page.locator('button[aria-controls="offline-queue-panel"]');
    await expect(queueToggle).toBeVisible();
    await queueToggle.click();
    await expect(page.locator("#offline-queue-panel")).toBeVisible();
    await expect(page.getByText(/offline queue/i)).toBeVisible();

    await page.context().setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true);
    await expect(banner).toHaveAttribute("data-state", "online");
    await banner.getByRole("button", { name: /dismiss network status/i }).click();
    await expect(banner).not.toBeVisible({ timeout: 6000 });
  });
});
