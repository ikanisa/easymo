import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDashboardKpis, mockTimeseries } from "@/lib/mock-data";

const originalEnv = { ...process.env };

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

describe("dashboard snapshot", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_USE_MOCKS: "false" };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  it("returns Supabase snapshot when RPC succeeds", async () => {
    const originalWindow =
      (globalThis as unknown as { window?: unknown }).window;
    // Simulate server-side environment.
    delete (globalThis as unknown as { window?: unknown }).window;

    const { getSupabaseAdminClient } = await import(
      "@/lib/server/supabase-admin"
    ) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const snapshot = {
      kpis: [{
        label: "Active trips",
        primaryValue: "12",
        secondaryValue: "+8%",
        trend: "up",
      }],
      timeseries: [{ date: "2025-01-01T00:00:00Z", issued: 5, redeemed: 2 }],
    };
    getSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: snapshot, error: null }),
    });

    const { getDashboardSnapshot } = await import(
      "@/lib/dashboard/dashboard-service"
    );
    const result = await getDashboardSnapshot();
    expect(result).toEqual({
      data: snapshot,
      integration: { status: "ok", target: "dashboard_snapshot" },
    });

    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  });

  it("falls back to mocks when RPC fails", async () => {
    const originalWindow =
      (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { window?: unknown }).window;

    const { getSupabaseAdminClient } = await import(
      "@/lib/server/supabase-admin"
    ) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    getSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("boom") }),
    });

    const { getDashboardSnapshot } = await import(
      "@/lib/dashboard/dashboard-service"
    );
    const result = await getDashboardSnapshot();
    expect(result.integration.status).toBe("degraded");
    expect(result.data.kpis.length).toBe(mockDashboardKpis.length);
    expect(result.data.timeseries.length).toBe(mockTimeseries.length);

    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  });
});
