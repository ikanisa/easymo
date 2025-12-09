// @ts-nocheck

import { test, expect } from "@playwright/test";
import { setSession } from "./support/session";

test.beforeEach(async ({ request, page }) => {
  await setSession(request, page, "anonymous");
});

test.describe("core smoke", () => {
  test("login screen renders primary affordances", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: /sacco\+/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await page.getByRole("textbox", { name: /email/i }).fill("staff@example.com");
    await page.getByLabel(/password/i).fill("hunter2!");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  test("dashboard loads stub metrics when authenticated", async ({ page, request }) => {
    await setSession(request, page, "authenticated");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /sacco overview/i })).toBeVisible();
    await expect(page.getByText("Imbere Heza", { exact: true })).toBeVisible();
    await expect(page.getByText("Abishyizehamwe", { exact: true })).toBeVisible();
  });

  test("members directory exposes atlas filter bar and command palette", async ({
    page,
    request,
  }) => {
    await setSession(request, page, "authenticated");
    await page.goto("/admin/members");
    await expect(page.getByRole("heading", { name: /member directory/i })).toBeVisible();
    await expect(page.getByLabel(/search members/i)).toBeVisible();
    await page.getByRole("button", { name: /command palette/i }).click();
    const palette = page.getByRole("dialog", { name: /command palette/i });
    await expect(palette).toBeVisible();
    await palette.getByRole("button", { name: /^close$/i }).click();
    await page.getByRole("button", { name: /save view/i }).click();
    await page.getByLabel(/view name/i).fill("Smoke view");
    await page.getByRole("button", { name: /^save view$/i }).click();
    await expect(page.getByRole("button", { name: /saved views/i })).toBeVisible();
  });

  test("member profile drawer requires review before submit", async ({ page, request }) => {
    await setSession(request, page, "authenticated");
    await page.goto("/member/profile");
    await expect(page.getByText(/contact details/i)).toBeVisible();
    await page.getByRole("button", { name: /advanced settings/i }).click();
    await page.getByLabel(/whatsapp number/i).fill("250700000000");
    await page.getByLabel(/momo number/i).fill("250730000000");
    await page.getByRole("button", { name: /review changes/i }).click();
    await expect(page.getByText(/confirm the updates/i)).toBeVisible();
    await page.getByRole("button", { name: /back/i }).click();
    await page.getByRole("button", { name: /close advanced settings/i }).click();
  });

  test("loans pipeline toggles board and table views", async ({ page, request }) => {
    await setSession(request, page, "authenticated");
    await page.goto("/admin/loans");
    await expect(page.getByRole("heading", { name: /loans pipeline/i })).toBeVisible();
    await expect(page.getByText(/stage summary/i)).toBeVisible();
    await page.getByRole("button", { name: /table/i }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("button", { name: /board/i }).click();
    await expect(page.getByRole("button", { name: /clear filters/i })).toBeVisible();
  });
});
