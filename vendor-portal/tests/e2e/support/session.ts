// @ts-nocheck

import type { APIRequestContext, Page } from "@playwright/test";

export type SessionState = "authenticated" | "anonymous";

const BASE_URL =
  process.env.PLAYWRIGHT_REMOTE_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3100";
const isRemote = process.env.PLAYWRIGHT_REMOTE === "1";

/**
 * Mirrors the stubbed session state into both the API harness and the browser context
 * so React server components see consistent authentication on navigations.
 */
export async function setSession(request: APIRequestContext, page: Page, state: SessionState) {
  if (state === "anonymous") {
    if (!isRemote) {
      await request.delete("/api/e2e/session");
    }
    await page.context().clearCookies();
    return;
  }

  if (isRemote) {
    const email = process.env.PLAYWRIGHT_REMOTE_EMAIL;
    const password = process.env.PLAYWRIGHT_REMOTE_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "PLAYWRIGHT_REMOTE_EMAIL and PLAYWRIGHT_REMOTE_PASSWORD are required for remote sessions"
      );
    }

    await page.goto(`${BASE_URL}/login`);
    await page.getByRole("textbox", { name: /email/i }).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.getByRole("button", { name: /sign in/i }).click(),
    ]);
    await page.waitForURL(/dashboard|admin/, { timeout: 15_000 });
    return;
  }

  await request.post("/api/e2e/session", { data: { state } });
  await page.context().addCookies([
    {
      name: "stub-auth",
      value: "1",
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
