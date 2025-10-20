import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";

const PRIMARY_SECRET = "primary-secret-abcdef1234567890";
const FALLBACK_SECRET = "fallback-secret-abcdef1234567890";

describe("session-token", () => {
  const originalPrimary = process.env.ADMIN_SESSION_SECRET;
  const originalFallback = process.env.ADMIN_SESSION_SECRET_FALLBACK;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = PRIMARY_SECRET;
    process.env.ADMIN_SESSION_SECRET_FALLBACK = FALLBACK_SECRET;
  });

  afterEach(() => {
    if (originalPrimary) {
      process.env.ADMIN_SESSION_SECRET = originalPrimary;
    } else {
      delete process.env.ADMIN_SESSION_SECRET;
    }
    if (originalFallback) {
      process.env.ADMIN_SESSION_SECRET_FALLBACK = originalFallback;
    } else {
      delete process.env.ADMIN_SESSION_SECRET_FALLBACK;
    }
  });

  it("verifies tokens signed with the primary secret", async () => {
    const { token } = await createSessionToken("actor-primary");
    const claims = await verifySessionToken(token);
    expect(claims?.sub).toBe("actor-primary");
  });

  it("accepts tokens signed with the fallback secret", async () => {
    process.env.ADMIN_SESSION_SECRET = FALLBACK_SECRET;
    const { token } = await createSessionToken("actor-fallback");
    process.env.ADMIN_SESSION_SECRET = PRIMARY_SECRET;

    const claims = await verifySessionToken(token);
    expect(claims?.sub).toBe("actor-fallback");
  });

  it("ignores fallback values shorter than 16 characters", async () => {
    process.env.ADMIN_SESSION_SECRET_FALLBACK = "short";
    const { token } = await createSessionToken("actor-short");
    const claims = await verifySessionToken(token);
    expect(claims?.sub).toBe("actor-short");
  });
});
