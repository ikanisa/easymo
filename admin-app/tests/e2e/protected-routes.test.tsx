import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { createSessionCookie } from "@/lib/server/session";

/**
 * Constructs a NextRequest for testing middleware behavior with optional authentication
 * @param path - The request path (e.g., "/dashboard", "/notifications")
 * @param cookieHeader - Optional cookie header string to simulate authenticated requests
 * @returns A NextRequest instance configured for testing
 */
const buildRequest = (path: string, cookieHeader?: string) =>
  new NextRequest(new URL(`https://example.com${path}`), {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

describe("protected route guard", () => {
  it("clears expired sessions and blocks access", async () => {
    const expiredCookie = createSessionCookie({
      actorId: "deadbeef-dead-beef-dead-beefdeadbeef",
      label: "Expired",
      ttlMs: -1_000,
    });
    const request = buildRequest("/dashboard", `${expiredCookie.name}=${expiredCookie.value}`);

    const response = await middleware(request);

    expect(response.status).toBe(401);
    expect(response.cookies.get("admin_session")?.value).toBe("");
  });

  it("allows requests that carry a valid session token", async () => {
    const sessionCookie = createSessionCookie({
      actorId: "00000000-0000-0000-0000-000000000999",
      label: "QA Operator",
      ttlMs: 5 * 60 * 1000,
    });
    const request = buildRequest("/notifications", `${sessionCookie.name}=${sessionCookie.value}`);

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.cookies.get("admin_session")?.value).toBeUndefined();
  });
});
