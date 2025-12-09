// @ts-nocheck

import { expect, test } from "@playwright/test";
import { setSession } from "./support/session";

test.describe("migrated atlas flows", () => {
  test.beforeEach(async ({ page, request }) => {
    await setSession(request, page, "authenticated");
  });

  test("navigates to analytics, operations, and reports", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("link", { name: /analytics/i }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /executive analytics/i })
    ).toBeVisible();

    await page.getByRole("link", { name: /operations/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /operations center/i })).toBeVisible();

    await page.getByRole("link", { name: /reports/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /reports/i })).toBeVisible();
  });

  test("quick actions deep-link to recon workflow", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /quick actions/i }).click();
    await page.getByRole("link", { name: /review recon/i }).click();
    await expect(page).toHaveURL(/\/recon/);
    await expect(page.getByRole("heading", { level: 1, name: /reconciliation/i })).toBeVisible();
  });
});
