import { expect, test } from "@playwright/test";
import { setSession } from "./support/session";

test.describe("automation health banner", () => {
  test.beforeEach(async ({ page, request }) => {
    await request.delete("/api/e2e/automation-health");
    await setSession(request, page, "authenticated");
  });

  test.afterEach(async ({ request }) => {
    await request.delete("/api/e2e/automation-health");
  });

  test("renders when pollers or gateways are unhealthy", async ({ page, request }) => {
    await request.post("/api/e2e/automation-health", {
      data: {
        pollers: [
          {
            id: "poller-1",
            displayName: "MTN MoMo",
            status: "ACTIVE",
            lastPolledAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            lastError: "Provider timeout",
            lastLatencyMs: 120000,
          },
        ],
        gateways: [
          {
            id: "gateway-1",
            displayName: "Primary GSM",
            status: "DOWN",
            lastHeartbeatAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            lastError: "No signal",
            lastLatencyMs: 5000,
          },
        ],
      },
    });

    await page.goto("/admin/reconciliation");
    const banner = page.getByTestId("automation-health-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("MTN MoMo");
    await expect(banner).toContainText("Primary GSM");
    await expect(banner).toContainText("Automation attention required");
  });

  test("hides when systems recover", async ({ page, request }) => {
    await request.post("/api/e2e/automation-health", {
      data: {
        pollers: [],
        gateways: [],
      },
    });

    await page.goto("/admin/reconciliation");
    await expect(page.locator('[data-testid="automation-health-banner"]')).toHaveCount(0);
  });
});
