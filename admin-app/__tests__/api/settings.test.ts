// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  })),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    set: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(() => []),
  }),
  headers: () => ({
    get: vi.fn(),
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: class {
    static json(data: any, init?: any) { return new Response(JSON.stringify(data), init); }
  },
}));

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: () => ({
    check: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  requireActorId: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

vi.mock("@/lib/server/audit", () => ({
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  logStructured: vi.fn(),
}));

vi.mock("@/app/api/withObservability", () => ({
  createHandler: (name: string, handler: any) => handler,
}));

import { GET, POST } from "@/app/api/settings/route";
import { recordAudit } from "@/lib/server/audit";
import { requireActorId, UnauthorizedError } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

describe("Settings API", () => {
  const mockSupabaseAdmin = {
    from: vi.fn(() => ({
      select: vi.fn(),
      upsert: vi.fn(),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabaseAdmin as any);
    vi.mocked(requireActorId).mockReturnValue("admin-123");
  });

  describe("GET /api/settings", () => {
    it("should return 503 if Supabase admin client is unavailable", async () => {
      vi.mocked(getSupabaseAdminClient).mockReturnValue(null);

      const req = new Request("http://localhost/api/settings", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe("settings_unavailable");
    });

    it("should return 503 if settings fetch fails", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });
      mockSupabaseAdmin.from.mockReturnValue({ select: mockSelect });

      const req = new Request("http://localhost/api/settings", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe("settings_unavailable");
    });

    it("should return default settings when no data exists", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      mockSupabaseAdmin.from.mockReturnValue({ select: mockSelect });

      const req = new Request("http://localhost/api/settings", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        quietHours: { start: "22:00", end: "06:00" },
        throttlePerMinute: 60,
        optOutList: [],
      });
    });

    it("should return settings from Supabase", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          { key: "quiet_hours.rw", value: { start: "23:00", end: "07:00" } },
          { key: "send_throttle.whatsapp.per_minute", value: { value: 30 } },
          { key: "opt_out.list", value: ["+1234567890", "+0987654321"] },
        ],
        error: null,
      });
      mockSupabaseAdmin.from.mockReturnValue({ select: mockSelect });

      const req = new Request("http://localhost/api/settings", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        quietHours: { start: "23:00", end: "07:00" },
        throttlePerMinute: 30,
        optOutList: ["+1234567890", "+0987654321"],
      });
    });
  });

  describe("POST /api/settings", () => {
    it("should return 503 if Supabase admin client is unavailable", async () => {
      vi.mocked(getSupabaseAdminClient).mockReturnValue(null);

      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({
          quietHours: { start: "22:00", end: "06:00" },
          throttlePerMinute: 60,
          optOutList: [],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe("settings_unavailable");
    });

    it("should return 400 for invalid input (negative throttle)", async () => {
      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({
          quietHours: { start: "22:00", end: "06:00" },
          throttlePerMinute: -5,
          optOutList: [],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("validation_error");
    });

    it("should return 400 for invalid input (missing quietHours)", async () => {
      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({
          throttlePerMinute: 60,
          optOutList: [],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("validation_error");
    });

    it("should return 401 if user is not authenticated", async () => {
      vi.mocked(requireActorId).mockImplementation(() => {
        throw new UnauthorizedError("No session found");
      });

      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({
          quietHours: { start: "22:00", end: "06:00" },
          throttlePerMinute: 60,
          optOutList: [],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("unauthorized");
    });

    it("should successfully update settings", async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseAdmin.from.mockReturnValue({ upsert: mockUpsert });

      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({
          quietHours: { start: "23:00", end: "07:00" },
          throttlePerMinute: 45,
          optOutList: ["+1234567890"],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe("Settings saved.");
      expect(data.integration.status).toBe("ok");

      // Verify Supabase upsert was called
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: "quiet_hours.rw" }),
          expect.objectContaining({ key: "send_throttle.whatsapp.per_minute" }),
          expect.objectContaining({ key: "opt_out.list" }),
        ])
      );

      // Verify audit was recorded
      expect(recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "admin-123",
          action: "settings_update",
          targetTable: "settings",
        })
      );
    });

    it("should handle empty optOutList", async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseAdmin.from.mockReturnValue({ upsert: mockUpsert });

      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({
          quietHours: { start: "22:00", end: "06:00" },
          throttlePerMinute: 60,
          optOutList: [],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify the optOutList was included in the upsert
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: "opt_out.list", value: [] }),
        ])
      );
    });
  });
});
