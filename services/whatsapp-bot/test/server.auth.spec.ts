import request from "supertest";

let sendMock: jest.Mock;

jest.mock("@easymo/messaging", () => ({
  KafkaFactory: jest.fn().mockImplementation(() => ({
    createProducer: () => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: (...args: unknown[]) => sendMock(...args),
    }),
  })),
  IdempotencyStore: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    execute: (_key: string, handler: () => Promise<unknown>) => handler(),
  })),
}));

describe.skip("whatsapp-bot auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.PORT = "0";
    process.env.META_VERIFY_TOKEN = "verify";
    process.env.META_PAGE_TOKEN = "page-token";
    process.env.KAFKA_BROKERS = "localhost:9092";
    process.env.KAFKA_CLIENT_ID = "whatsapp-bot";
    process.env.INBOUND_TOPIC = "whatsapp.inbound";
    process.env.OUTBOUND_TOPIC = "whatsapp.outbound";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.OPT_OUT_PATTERN = "\\bSTOP\\b";
    process.env.WHATSAPP_API_BASE_URL = "https://graph.facebook.com/v20.0";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.SUPPORT_AGENT_URL = "https://support.example.com";
    process.env.SUPPORT_KEYWORDS = "support";
    process.env.SERVICE_AUTH_AUDIENCE = "whatsapp-bot";
    delete process.env.RATE_LIMIT_REDIS_URL;
  });

  const getApp = () => {
    sendMock = jest.fn();
    const { app } = require("../src/server");
    return app;
  };

  const sign = async (scopes: string[]) => {
    const { signServiceJwt } = require("@easymo/commons");
    return signServiceJwt({ audience: "whatsapp-bot", scope: scopes });
  };

  it("rejects outbound without token", async () => {
    const app = getApp();
    const response = await request(app)
      .post("/outbound/messages")
      .send({ to: "+14155551234", text: "hello" });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects outbound with wrong scope", async () => {
    const app = getApp();
    const token = await sign(["whatsapp:analytics.read"]);
    const response = await request(app)
      .post("/outbound/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ to: "+14155551234", text: "hello" });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("allows outbound with proper scope", async () => {
    const app = getApp();
    const token = await sign(["whatsapp:outbound.write"]);
    const response = await request(app)
      .post("/outbound/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ to: "+14155551234", text: "hello" });
    expect(response.status).toBe(202);
    expect(sendMock).toHaveBeenCalled();
  });
});
