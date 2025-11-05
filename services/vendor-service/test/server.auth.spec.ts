import request from "supertest";

let prismaMock: any;
let vendorServiceMock: any;

describe("vendor-service auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.PORT = "0";
    process.env.DEFAULT_TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";
    process.env.SERVICE_AUTH_AUDIENCE = "vendor-service";
    process.env.SERVICE_JWT_KEYS = "test-secret";
    process.env.FEATURE_MARKETPLACE_VENDOR = "1";
    prismaMock = {
      vendorProfile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    vendorServiceMock = {
      createVendor: jest.fn().mockResolvedValue({ id: "vendor" }),
      listVendors: jest.fn().mockResolvedValue([]),
      createQuote: jest.fn().mockResolvedValue({ id: "quote" }),
    };
  });

  const getApp = () => {
    const { buildApp } = require("../src/server");
    return buildApp({ prisma: prismaMock, vendors: vendorServiceMock } as any);
  };

  const sign = async (scopes: string[]) => {
    const { signServiceJwt } = require("@easymo/commons");
    return signServiceJwt({ audience: "vendor-service", scope: scopes });
  };

  it("rejects vendor creation without token", async () => {
    const app = getApp();
    const response = await request(app)
      .post("/vendors")
      .send({ tenantId: process.env.DEFAULT_TENANT_ID, name: "Vendor", region: "north", categories: ["cars"] });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects vendor list with wrong scope", async () => {
    const app = getApp();
    const token = await sign(["vendor:write"]);
    const response = await request(app)
      .get("/vendors")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("allows vendor list with read scope", async () => {
    const app = getApp();
    const token = await sign(["vendor:read"]);
    const response = await request(app)
      .get("/vendors")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
  });

  it("allows quote creation with quote scope", async () => {
    const app = getApp();
    const token = await sign(["vendor:quote.write"]);
    const response = await request(app)
      .post("/vendors/11111111-1111-1111-1111-111111111111/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({ tenantId: process.env.DEFAULT_TENANT_ID, intentId: "22222222-2222-2222-2222-222222222222", price: 10, currency: "USD" });
    expect(response.status).toBe(201);
  });
});
