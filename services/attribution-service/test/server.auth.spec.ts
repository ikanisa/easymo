import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAttributionServiceRoutePath, signServiceJwt } from "@easymo/commons";
import type { PrismaService } from "@easymo/db";
import request from "supertest";

import type { evaluateAttribution as evaluateAttributionType } from "../src/evaluator";

vi.mock("../src/evaluator", () => ({
  evaluateAttribution: vi.fn().mockReturnValue({ type: "ENDORER", entityId: "agent-1" }),
}));

const evaluateAttribution = require("../src/evaluator").evaluateAttribution as jest.MockedFunction<typeof evaluateAttributionType>;

async function setupApp(overrides?: { prisma?: Partial<{ quote: unknown; attributionEvidence: unknown; dispute: unknown }> }) {
  jest.clearAllMocks();
  process.env.NODE_ENV = "test";
  process.env.SERVICE_JWT_KEYS = "test-secret";
  process.env.SERVICE_JWT_ISSUER = "test-issuer";
  process.env.SERVICE_NAME = "attribution-service";
  process.env.SERVICE_AUTH_AUDIENCE = "attribution-service";
  delete process.env.RATE_LIMIT_REDIS_URL;

  const prismaMock = {
    quote: {
      update: vi.fn().mockResolvedValue({ id: "quote-1" }),
    },
    attributionEvidence: {
      create: vi.fn().mockResolvedValue({ id: "evidence-1" }),
    },
    dispute: {
      create: vi.fn().mockResolvedValue({ id: "dispute-1" }),
    },
  };

  Object.assign(prismaMock, overrides);

  const module = await import("../src/server");
  const app = module.buildApp({
    prisma: prismaMock as unknown as PrismaService,
  });

  return { app, prismaMock };
}

describe("attribution-service authentication", () => {
  it("rejects missing token", async () => {
    const { app } = await setupApp();

    const response = await request(app)
      .post(getAttributionServiceRoutePath("evaluate"))
      .send({ referrals: [], events: [] });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects invalid scope", async () => {
    const { app } = await setupApp();
    const token = await signServiceJwt({
      audience: "attribution-service",
      scope: ["wallet:read"],
    });

    const response = await request(app)
      .post(getAttributionServiceRoutePath("evaluate"))
      .set("Authorization", `Bearer ${token}`)
      .send({ referrals: [], events: [] });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("allows valid scope", async () => {
    const { app, prismaMock } = await setupApp();
    const token = await signServiceJwt({
      audience: "attribution-service",
      scope: ["attribution:write"],
    });

    const response = await request(app)
      .post(getAttributionServiceRoutePath("evaluate"))
      .set("Authorization", `Bearer ${token}`)
      .send({ quoteId: "1f8fe6a0-ef67-4a6d-8285-829af6f7dabe", persist: true });

    expect(response.status).toBe(200);
    expect(evaluateAttribution).toHaveBeenCalled();
    expect(prismaMock.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "1f8fe6a0-ef67-4a6d-8285-829af6f7dabe" } }),
    );
  });
});
