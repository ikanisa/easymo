import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("next/headers", () => ({
  cookies: () => ({
    set: vi.fn(),
    get: vi.fn(),
  }),
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

describe("Auth Login API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_ACCESS_CREDENTIALS = JSON.stringify([
      { actorId: "user-123", email: "admin@example.com", password: "password123", label: "Admin User" },
    ]);
  });

  it("should return 200 for valid credentials", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "password123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ actorId: "user-123", label: "Admin User" });
  });

  it("should return 401 for invalid credentials", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "wrongpassword" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Invalid credentials");
  });

  it("should return 400 for invalid input format", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });
});
