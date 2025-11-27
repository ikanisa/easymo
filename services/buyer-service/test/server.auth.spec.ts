import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signServiceJwt } from "@easymo/commons";
import type { PrismaService } from "@easymo/db";
import request from "supertest";

import type { BuyerService } from "../src/service";

const DEFAULT_TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";

type PrismaMock = {
  purchase: { findUnique: jest.Mock; update: jest.Mock };
  walletAccount: { findFirst: jest.Mock };
};

type BuyersMock = {
  createBuyer: jest.Mock;
  createIntent: jest.Mock;
  listIntents: jest.Mock;
  listPurchases: jest.Mock;
  recordPurchase: jest.Mock;
  buyerContext: jest.Mock;
};

async function setupApp(overrides?: {
  prisma?: Partial<PrismaMock>;
  buyers?: Partial<BuyersMock>;
}) {
  jest.resetModules();
  process.env.NODE_ENV = "test";
  process.env.FEATURE_MARKETPLACE_BUYER = "1";
  process.env.SERVICE_JWT_KEYS = "test-secret";
  process.env.SERVICE_JWT_ISSUER = "test-issuer";
  process.env.SERVICE_NAME = "buyer-service";
  process.env.SERVICE_AUTH_AUDIENCE = "buyer-service";
  process.env.DEFAULT_TENANT_ID = DEFAULT_TENANT_ID;
  delete process.env.RATE_LIMIT_REDIS_URL;

  const prismaMock: PrismaMock = {
    purchase: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    walletAccount: {
      findFirst: vi.fn(),
    },
  };

  const buyersMock: BuyersMock = {
    createBuyer: vi.fn().mockResolvedValue({ id: "buyer-1" }),
    createIntent: vi.fn(),
    listIntents: vi.fn().mockResolvedValue([]),
    listPurchases: vi.fn().mockResolvedValue([]),
    recordPurchase: vi.fn(),
    buyerContext: vi.fn(),
  };

  Object.assign(prismaMock, overrides?.prisma);
  Object.assign(buyersMock, overrides?.buyers);

  const module = await import("../src/server");
  const app = module.buildApp({
    prisma: prismaMock as unknown as PrismaService,
    buyers: buyersMock as unknown as BuyerService,
  });

  return { app, prismaMock, buyersMock };
}

describe("buyer-service authentication", () => {
  it("rejects requests without bearer token", async () => {
    const { app } = await setupApp();

    const response = await request(app)
      .post("/buyers")
      .send({ tenantId: DEFAULT_TENANT_ID, name: "Test Buyer" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects requests missing required scopes", async () => {
    const { app } = await setupApp();
    const token = await signServiceJwt({
      audience: "buyer-service",
      scope: ["buyer:read"],
    });

    const response = await request(app)
      .post("/buyers")
      .set("Authorization", `Bearer ${token}`)
      .send({ tenantId: DEFAULT_TENANT_ID, name: "Test Buyer" });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("allows requests with valid scope", async () => {
    const createBuyer = vi.fn().mockResolvedValue({ id: "buyer-123" });
    const { app, buyersMock } = await setupApp({
      buyers: { createBuyer },
    });

    const token = await signServiceJwt({
      audience: "buyer-service",
      scope: ["buyer:write"],
    });

    const response = await request(app)
      .post("/buyers")
      .set("Authorization", `Bearer ${token}`)
      .send({ tenantId: DEFAULT_TENANT_ID, name: "Test Buyer" });

    expect(response.status).toBe(201);
    expect(createBuyer).toHaveBeenCalledTimes(1);
    expect(buyersMock.createBuyer).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: DEFAULT_TENANT_ID }),
    );
  });
});
