import { expect, test } from "@playwright/test";
import { setSession } from "./support/session";

const isRemote = process.env.PLAYWRIGHT_REMOTE === "1";

// Remote-only smoke test that exercises the real staging auth and invite flow.
test.describe("staging smoke", () => {
  test.skip(!isRemote, "Runs only when PLAYWRIGHT_REMOTE=1 against staging");

  test("admin login and invite", async ({ page, request }) => {
    await setSession(request, page, "authenticated");

    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: /staff directory/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /add\/invite staff/i })).toBeVisible();

    const inviteEmail =
      process.env.PLAYWRIGHT_INVITE_EMAIL ?? `staging-invite+${Date.now()}@example.com`;

    await page.getByLabel(/email/i).fill(inviteEmail);
    await page.getByLabel(/role/i).selectOption("SYSTEM_ADMIN");
    await page.getByRole("button", { name: /send invite/i }).click();

    await expect(page.getByText(/invitation sent/i)).toBeVisible({ timeout: 20_000 });
  });
});
