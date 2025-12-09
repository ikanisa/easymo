// @ts-nocheck

import { test, expect } from "@playwright/test";
import { setSession } from "./support/session";

test.describe("multicountry configuration", () => {
  test.beforeEach(async ({ page, request }) => {
    await setSession(request, page, "authenticated");
  });

  test("updates country configuration", async ({ page }) => {
    await page.goto("/countries/stub-country-rw");

    await expect(page.getByRole("heading", { name: /rwanda configuration/i })).toBeVisible();

    const referenceInput = page.getByLabel(/reference format/i);
    await referenceInput.fill("A1.B2.C3");

    const notesInput = page.getByLabel(/settlement notes/i);
    await notesInput.fill("Daily reconciliation closes at 20:00 with treasury sign-off.");

    await page.getByLabel(/statement ingest/i).check();

    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/country settings updated/i)).toBeVisible();

    await page.reload();

    await expect(page.getByLabel(/reference format/i)).toHaveValue("A1.B2.C3");
    await expect(page.getByLabel(/settlement notes/i)).toHaveValue(
      "Daily reconciliation closes at 20:00 with treasury sign-off."
    );
    await expect(page.getByLabel(/statement ingest/i)).toBeChecked();
  });

  test("updates partner configuration", async ({ page }) => {
    await page.goto("/partners/stub-partner-amahoro");

    await expect(page.getByRole("heading", { name: /amahoro sacco settings/i })).toBeVisible();

    await page.getByLabel(/merchant code/i).fill("789010");
    await page.getByLabel(/reference prefix/i).fill("AMH");
    await page.getByLabel(/supported locales/i).fill("rw-RW\nen-RW\nfr-RW");
    await page.getByLabel(/support phone/i).fill("+250788111222");
    await page.getByLabel(/support email/i).fill("help@amahoro.rw");
    await page.getByLabel(/operating hours/i).fill("Mon-Sat 08:00-18:00");

    const featureToggle = page.getByLabel(/nfc tap to pay/i);
    if (await featureToggle.isChecked()) {
      await featureToggle.uncheck();
    }
    await featureToggle.check();

    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/partner settings updated/i)).toBeVisible();

    await page.reload();

    await expect(page.getByLabel(/merchant code/i)).toHaveValue("789010");
    await expect(page.getByLabel(/reference prefix/i)).toHaveValue("AMH");
    await expect(page.getByLabel(/supported locales/i)).toHaveValue("rw-RW\nen-RW\nfr-RW");
    await expect(page.getByLabel(/support phone/i)).toHaveValue("+250788111222");
    await expect(page.getByLabel(/support email/i)).toHaveValue("help@amahoro.rw");
    await expect(page.getByLabel(/operating hours/i)).toHaveValue("Mon-Sat 08:00-18:00");
    await expect(page.getByLabel(/nfc tap to pay/i)).toBeChecked();
  });
});
