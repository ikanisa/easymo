import request from "supertest";

describe("reconciliation-service auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.PORT = "0";
    process.env.DEFAULT_TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";
    process.env.WALLET_SERVICE_URL = "http://wallet-service";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.RECON_SOURCE_ACCOUNT_ID = "f7f034a8-b48d-4bcf-9b00-000000000001";
    process.env.SERVICE_AUTH_AUDIENCE = "reconciliation-service";
    process.env.SERVICE_JWT_KEYS = "test-secret";
    delete process.env.RATE_LIMIT_REDIS_URL;
  });

  const getApp = () => {
    const { buildApp } = require("../src/server");
    const store = {
      execute: jest.fn(async (_key: string, handler: () => Promise<unknown>) => handler()),
    };
    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: {} }),
      get: jest.fn().mockResolvedValue({ data: { id: "wallet-dest" } }),
    };
    const app = buildApp({ store, httpClient });
    return { app, store, httpClient };
  };

  const sign = async (scopes: string[]) => {
    const { signServiceJwt } = require("@easymo/commons");
    return signServiceJwt({ audience: "reconciliation-service", scope: scopes });
  };

  const csvBuffer = Buffer.from("reference,amount,currency,narration\nref1,10,USD,WALLET:11111111-1111-1111-1111-111111111111\n");

  it("rejects missing token", async () => {
    const { app } = getApp();
    const response = await request(app)
      .post("/reconciliation/mobile-money")
      .attach("file", csvBuffer, { filename: "sample.csv" });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects wrong scope", async () => {
    const { app } = getApp();
    const token = await sign(["reconciliation:read"]);
    const response = await request(app)
      .post("/reconciliation/mobile-money")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", csvBuffer, { filename: "sample.csv" });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("accepts valid scope", async () => {
    const { app, store, httpClient } = getApp();
    const token = await sign(["reconciliation:write"]);
    const response = await request(app)
      .post("/reconciliation/mobile-money")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", csvBuffer, { filename: "sample.csv" });
    expect(response.status).toBe(202);
    expect(store.execute).toHaveBeenCalled();
    expect(httpClient.post).toHaveBeenCalled();
  });
});
