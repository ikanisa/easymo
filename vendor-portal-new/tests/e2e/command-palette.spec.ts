// @ts-nocheck

import { expect, test } from "@playwright/test";
import { setSession } from "./support/session";

async function loadAxe(page) {
  await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/axe-core@4.10.0/axe.min.js" });
}

test.describe("command palette", () => {
  test.beforeEach(async ({ page, request }) => {
    await setSession(request, page, "authenticated");
    await page.goto("/dashboard");
  });

  test("opens via keyboard shortcut and restores focus", async ({ page }) => {
    const trigger = page.locator('button[aria-label="Search"]');
    await trigger.focus();
    await page.keyboard.press("Control+KeyK");

    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();
    await expect(page.locator('input[placeholder*="Search ikimina"]')).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("supports arrow navigation and passes axe audit", async ({ page }) => {
    const trigger = page.locator('button[aria-label="Search"]');
    await trigger.click();

    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();
    const searchInput = page.locator('input[placeholder*="Search ikimina"]');
    await expect(searchInput).toBeFocused();

    await loadAxe(page);
    const results = await page.evaluate(async () => {
      if (!window.axe) {
        throw new Error("axe-core failed to load");
      }
      return window.axe.run(document.querySelector('[role="dialog"][aria-modal="true"]'), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });
    });

    const summary = results.violations
      .map((violation) => {
        const impacted = violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" > ") || node.html)
          .join(" | ");
        return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.description} -> ${impacted}`;
      })
      .join("\n");

    expect(results.violations, summary || "No accessibility violations detected").toEqual([]);

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeFocused();

    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("ArrowDown");
    }

    await page.waitForFunction(() =>
      document.activeElement?.textContent?.toLowerCase().includes("import members")
    );
    await expect(page.getByRole("link", { name: /import members/i })).toBeFocused();

    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("link", { name: /create ikimina/i })).toBeFocused();
  });
});
