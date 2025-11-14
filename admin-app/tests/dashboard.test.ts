import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      timeseries: [],
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
  });

  it("throws when Supabase RPC fails", async () => {
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
    await expect(getDashboardSnapshot()).rejects.toThrow(
      "Supabase RPC dashboard_snapshot returned an error",
    );
  });
});
