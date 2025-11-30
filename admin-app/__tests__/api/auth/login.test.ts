// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Pre-computed bcrypt hash for "password123" with 10 salt rounds
const PASSWORD_HASH = "$2b$10$B8eeOA6.A/Rouqq8dqYOleA/olZcoRfb3TNOLB7Q2FL.qhpDkDjyy";

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
    static redirect(url: string, init?: any) { return new Response(null, { status: 302, headers: { Location: url }, ...init }); }
  },
}));

vi.mock("@/lib/server/rate-limit", () => ({
  clearRateLimit: vi.fn(),
  getRateLimit: vi.fn(() => ({ remaining: 5, resetIn: 1000 })),
  recordFailure: vi.fn(),
}));

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: () => ({
    check: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { POST } from "@/app/api/auth/login/route";

describe("Auth Login API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use passwordHash (bcrypt) instead of plaintext password
    process.env.ADMIN_ACCESS_CREDENTIALS = JSON.stringify([
      { actorId: "user-123", email: "admin@example.com", passwordHash: PASSWORD_HASH, label: "Admin User" },
    ]);
    // 32+ chars required for HMAC-SHA256 security
    process.env.ADMIN_SESSION_SECRET = "test-secret-key-minimum-32-chars-required";
  });

  it("should return 200 for valid credentials", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "password123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ actorId: "user-123", label: "Admin User" });
  });

  it("should return 401 for invalid credentials", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "wrongpassword" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Invalid credentials");
  });

  it("should return 400 for invalid input format", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "1234567" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });
});
