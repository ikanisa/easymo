import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from "supertest";

let vendorFindMock: jest.Mock;
let vendorUpdateMock: jest.Mock;

vi.mock("@easymo/commons", () => {
  const actual = jest.requireActual("@easymo/commons");
  return {
    ...actual,
    isFeatureEnabled: () => true,
  };
});

describe("ranking-service auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.PORT = "0";
    process.env.DEFAULT_TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";
    process.env.SERVICE_AUTH_AUDIENCE = "ranking-service";
    process.env.SERVICE_JWT_KEYS = "test-secret";
    vendorFindMock = vi.fn();
    vendorUpdateMock = vi.fn();
  });

  const getApp = () => {
    const { buildApp } = require("../src/server");
    const prismaStub: any = {
      vendorProfile: {
        findUnique: vendorFindMock,
        update: vendorUpdateMock,
      },
    };

    const rankingMock = {
      rankVendors: vi.fn().mockResolvedValue([]),
    } as any;

    return buildApp({ prisma: prismaStub, ranking: rankingMock });
  };

  const sign = async (scopes: string[]) => {
    const { signServiceJwt } = require("@easymo/commons");
    return signServiceJwt({ audience: "ranking-service", scope: scopes });
  };

  it("rejects GET /ranking/vendors without token", async () => {
    const app = getApp();
    const response = await request(app).get("/ranking/vendors");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects with insufficient scope", async () => {
    const app = getApp();
    const token = await sign(["ranking:feedback.write"]);
    const response = await request(app)
      .get("/ranking/vendors")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("allows GET with ranking:read scope", async () => {
    const app = getApp();
    const token = await sign(["ranking:read"]);
    const response = await request(app)
      .get("/ranking/vendors")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
  });

  it("allows feedback with write scope", async () => {
    vendorFindMock.mockResolvedValue({ id: "f7f034a8-b48d-4bcf-9b00-000000000001", tenantId: "a4a8cf2d-0a4f-446c-8bf2-28509641158f", rating: { toNumber: () => 4 }, fulfilmentRate: { toNumber: () => 0.8 } });
    vendorUpdateMock.mockResolvedValue({ id: "vendor-1" });
    const app = getApp();
    const token = await sign(["ranking:feedback.write"]);
    const response = await request(app)
      .post("/ranking/feedback")
      .set("Authorization", `Bearer ${token}`)
      .send({ vendorId: "f7f034a8-b48d-4bcf-9b00-000000000001", tenantId: "a4a8cf2d-0a4f-446c-8bf2-28509641158f", scores: { overall: 4 } });
    expect(response.status).toBe(200);
    expect(vendorUpdateMock).toHaveBeenCalled();
  });
});
