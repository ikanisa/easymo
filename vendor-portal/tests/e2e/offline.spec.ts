// @ts-nocheck

import { test, expect } from "@playwright/test";
import { setSession } from "./support/session";

test.describe("offline experience", () => {
  test("offline fallback route exposes recovery affordances", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /no internet connection/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /retry dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /review ikimina roster/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /go to reconciliation queue/i })).toBeVisible();
    await expect(page.getByText(/support@ibimina\.rw/i)).toBeVisible();
  });

  test("offline queue indicator exposes queued actions while offline", async ({
    page,
    request,
  }) => {
    await setSession(request, page, "authenticated");
    await page.goto("/dashboard");
    await page.waitForSelector("text=/Quick actions/i");

    await page.context().setOffline(true);

    try {
      await page.waitForFunction(() => navigator.onLine === false);
      await page.waitForSelector('button[aria-controls="offline-queue-panel"]');
      const indicator = page.locator('button[aria-controls="offline-queue-panel"]');
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveAttribute("aria-expanded", "false");
      await indicator.click();
      const panel = page.locator("#offline-queue-panel");
      await expect(panel).toBeVisible();
      await expect(indicator).toHaveAttribute("aria-expanded", "true");
      await expect(panel.getByText(/offline queue/i)).toBeVisible();
      await panel.getByRole("button", { name: /close offline queue/i }).click();
      await expect(indicator).toHaveAttribute("aria-expanded", "false");
    } finally {
      await page.context().setOffline(false);
    }
  });
});
