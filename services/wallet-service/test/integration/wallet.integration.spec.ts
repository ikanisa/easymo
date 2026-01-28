import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: ReturnType<typeof import("../../src/server")["buildApp"]>["app"];

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  const module = await import("../../src/server");
  app = module.buildApp().app;
});

describe("wallet-service integration", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("converts USD with deterministic tokens", async () => {
    const response = await request(app)
      .get("/fx/convert")
      .query({ amount: 10, currency: "USD" });

    expect(response.status).toBe(200);
    expect(response.body.currency).toBe("USD");
    expect(response.body.tokens).toBe(10);
    expect(response.body.usd).toBe(10);
  });
});
