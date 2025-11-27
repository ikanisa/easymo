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

vi.mock("@/lib/server/session", () => ({
  readSessionFromCookies: vi.fn(),
}));

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/app/api/withObservability", () => ({
  createHandler: (name: string, handler: any) => handler,
}));

import { POST } from "@/app/api/users/invite/route";
import { readSessionFromCookies } from "@/lib/server/session";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

describe("Users Invite API", () => {
  const mockSupabaseAdmin = {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(),
        updateUserById: vi.fn(),
      },
    },
  };

  const mockObservability = {
    log: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readSessionFromCookies).mockResolvedValue({
      actorId: "admin-123",
      label: "Admin User",
      expiresAt: new Date(Date.now() + 1000000).toISOString(),
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(mockSupabaseAdmin as any);
  });

  it("should return 401 if user is not authenticated", async () => {
    vi.mocked(readSessionFromCookies).mockResolvedValue(null);

    const req = new Request("http://localhost/api/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "newuser@example.com", role: "staff" }),
    });

    const res = await POST(req, {}, mockObservability);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 for invalid email format", async () => {
    const req = new Request("http://localhost/api/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", role: "staff" }),
    });

    const res = await POST(req, {}, mockObservability);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("should return 400 for invalid role", async () => {
    const req = new Request("http://localhost/api/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "newuser@example.com", role: "invalid_role" }),
    });

    const res = await POST(req, {}, mockObservability);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("should return 500 if Supabase admin client is unavailable", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(null);

    const req = new Request("http://localhost/api/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "newuser@example.com", role: "staff" }),
    });

    const res = await POST(req, {}, mockObservability);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Supabase admin client unavailable");
  });

  it("should return 400 if invite fails", async () => {
    mockSupabaseAdmin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "User already exists" },
    });

    const req = new Request("http://localhost/api/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "existing@example.com", role: "staff" }),
    });

    const res = await POST(req, {}, mockObservability);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("User already exists");
  });

  it("should successfully invite a user with staff role", async () => {
    mockSupabaseAdmin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "new-user-123", email: "newuser@example.com" } },
      error: null,
    });
    mockSupabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
      error: null,
    });

    const req = new Request("http://localhost/api/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "newuser@example.com", role: "staff" }),
    });

    const res = await POST(req, {}, mockObservability);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      status: "invited",
      userId: "new-user-123",
      role: "staff",
    });

    // Verify Supabase calls
    expect(mockSupabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "newuser@example.com",
      { data: { role: "staff" } }
    );
    expect(mockSupabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
      "new-user-123",
      expect.objectContaining({
        app_metadata: { role: "staff" },
      })
    );
  });

  it("should successfully invite a user with admin role (default)", async () => {
    mockSupabaseAdmin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "new-admin-456", email: "admin@example.com" } },
      error: null,
    });
    mockSupabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
      error: null,
    });

    const req = new Request("http://localhost/api/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com" }), // No role specified, should default to "admin"
    });

    const res = await POST(req, {}, mockObservability);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      status: "invited",
      userId: "new-admin-456",
      role: "admin",
    });
  });

  it("should log error if role update fails but still return success", async () => {
    mockSupabaseAdmin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "new-user-789", email: "user@example.com" } },
      error: null,
    });
    mockSupabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
      error: { message: "Failed to update role" },
    });

    const req = new Request("http://localhost/api/users/invite", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", role: "staff" }),
    });

    const res = await POST(req, {}, mockObservability);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("invited");

    // Verify error was logged
    expect(mockObservability.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ADMIN_INVITE_ROLE_UPDATE_FAILED",
        status: "error",
      })
    );
  });
});
