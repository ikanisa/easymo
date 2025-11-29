import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearRateLimit } from "@/lib/server/rate-limit";

import { createAdminApiRequest } from "./utils/api";

const VALID_EMAIL = "info@ikanisa.com";
const VALID_PASSWORD = "MoMo!!0099";

const createRequest = (body: Record<string, unknown>): Request =>
  createAdminApiRequest(["auth", "login"], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("login API", () => {
  beforeEach(() => {
    clearRateLimit(`login:${VALID_EMAIL}`);
  });

  afterEach(() => {
    clearRateLimit(`login:${VALID_EMAIL}`);
  });

  it("authenticates valid credentials and seeds session cookie", async () => {
    const { POST: login } = await import("@/app/api/auth/login/route");

    const response = await login(
      createRequest({ email: VALID_EMAIL, password: VALID_PASSWORD }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-admin-session-refreshed")).toBe("true");

    const payload = await response.json();
    expect(payload).toEqual({
      actorId: "00000000-0000-0000-0000-000000000001",
      label: "Test Operator",
    });

    const session = cookies().get("admin_session");
    expect(session?.value).toBeTruthy();
  });

  it("rejects malformed payloads with a validation error", async () => {
    const { POST: login } = await import("@/app/api/auth/login/route");

    const response = await login(createRequest({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Validation failed",
      code: "validation_error",
    });
  });

  it("enforces rate limits after repeated failures", async () => {
    const { POST: login } = await import("@/app/api/auth/login/route");

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await login(
        createRequest({ email: VALID_EMAIL, password: "wrong-password" }),
      );
      expect(response.status).toBe(401);
    }

    const lockedResponse = await login(
      createRequest({ email: VALID_EMAIL, password: "still-wrong" }),
    );

    expect(lockedResponse.status).toBe(429);
    const headers = lockedResponse.headers;
    expect(headers.get("Retry-After")).toBe("900");
    expect(headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});
