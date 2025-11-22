import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { createSessionCookie } from "@/lib/server/session";

import { middleware } from "../../middleware";

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
