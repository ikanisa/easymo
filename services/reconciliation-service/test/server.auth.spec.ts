import request from "supertest";
import {
  getReconciliationServiceEndpointPath,
  signServiceJwt,
} from "@easymo/commons";
import { buildApp } from "../src/server";

const mockExecute = jest.fn();

jest.mock("@easymo/messaging", () => ({
  IdempotencyStore: class {
    execute = mockExecute;
  },
}));

describe("reconciliation-service authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
    process.env.SERVICE_JWT_KEYS = "test-secret";
    process.env.SERVICE_JWT_ISSUER = "test-issuer";
    process.env.SERVICE_NAME = "reconciliation-service";
    process.env.SERVICE_AUTH_AUDIENCE = "reconciliation-service";
    delete process.env.RATE_LIMIT_REDIS_URL;
  });

  const app = buildApp({
    store: { execute: mockExecute },
    httpClient: { post: jest.fn().mockResolvedValue({}), get: jest.fn().mockResolvedValue({ data: { id: "wallet" } }) } as any,
  });

  it("rejects missing token", async () => {
    const response = await request(app)
      .post(getReconciliationServiceEndpointPath("reconciliation", "mobileMoney"))
      .send({ file: Buffer.from("test").toString("base64") });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects invalid scope", async () => {
    const token = await signServiceJwt({
      audience: "reconciliation-service",
      scope: ["wallet:read"],
    });

    const response = await request(app)
      .post(getReconciliationServiceEndpointPath("reconciliation", "mobileMoney"))
      .set("Authorization", `Bearer ${token}`)
      .send({ file: Buffer.from("test").toString("base64") });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("allows valid scope", async () => {
    const token = await signServiceJwt({
      audience: "reconciliation-service",
      scope: ["reconciliation:write"],
    });

    const response = await request(app)
      .post(getReconciliationServiceEndpointPath("reconciliation", "mobileMoney"))
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("reference,amount,currency,narration\nref-1,100,USD,WALLET:ENDORER-test"), {
        filename: "feedback.csv",
      });

    expect(response.status).toBe(202);
  });
});
