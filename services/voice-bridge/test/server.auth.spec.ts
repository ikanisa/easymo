import request from "supertest";
import type { CallListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/call";

const twilioCreateMock = jest.fn<Promise<{ sid: string }>, [CallListInstanceCreateOptions]>();

jest.mock("twilio", () => {
  return jest.fn(() => ({
    calls: {
      create: twilioCreateMock,
    },
  }));
});

jest.mock("@easymo/messaging", () => ({
  KafkaFactory: jest.fn().mockImplementation(() => ({
    createProducer: () => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn(),
    }),
  })),
}));

describe("voice-bridge authentication", () => {
beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.SERVICE_JWT_KEYS = "test-secret";
    process.env.SERVICE_AUTH_AUDIENCE = "voice-bridge";
    process.env.SERVICE_NAME = "voice-bridge";
    process.env.TWILIO_MEDIA_AUTH_TOKEN = "media-token";
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_OUTBOUND_CALLER_ID = "+12025550123";
    process.env.TWILIO_MEDIA_STREAM_WSS = "wss://example.com/twilio";
    process.env.OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o";
    process.env.OPENAI_REALTIME_API_KEY = "sk-test";
    process.env.KAFKA_BROKERS = "localhost:29092";
    process.env.KAFKA_CLIENT_ID = "voice-bridge";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.COMPLIANCE_PROMPT = "This call may be monitored.";
    process.env.OPT_OUT_PATTERN = "\\bSTOP\\b";
    process.env.CONTACT_TOPIC = "voice.contact.events";
    process.env.MEDIA_TOPIC = "voice.media.events";
    process.env.BACKEND_SESSION_URL = "https://backend.example.com/session";
    process.env.BRIDGE_SHARED_SECRET = "bridge-secret";
    process.env.DEFAULT_AGENT_PROFILE = "sales";
    delete process.env.RATE_LIMIT_REDIS_URL;
    twilioCreateMock.mockResolvedValue({ sid: "CA123" });
  });

  const getApp = () => {
    const { app } = require("../src/server");
    return app;
  };

  const sign = async (scope: string[]) => {
    const { signServiceJwt } = require("@easymo/commons");
    return signServiceJwt({ audience: "voice-bridge", scope });
  };

  it("rejects missing token", async () => {
    const app = getApp();
    const response = await request(app).get("/analytics/live-calls");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects invalid scope", async () => {
    const app = getApp();
    const token = await sign(["voice:outbound.write"]);
    const response = await request(app)
      .get("/analytics/live-calls")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("allows analytics read scope", async () => {
    const app = getApp();
    const token = await sign(["voice:read"]);
    const response = await request(app)
      .get("/analytics/live-calls")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
  });

  it("permits outbound call with proper scope", async () => {
    const app = getApp();
    const token = await sign(["voice:outbound.write"]);
    const response = await request(app)
      .post("/calls/outbound")
      .set("Authorization", `Bearer ${token}`)
      .send({
        to: "+14155552671",
        tenantId: "tenant-1",
        contactName: "Ada",
        region: "rwanda",
        profile: "sales",
      });
    expect(response.status).toBe(202);
    expect(twilioCreateMock).toHaveBeenCalledTimes(1);
    expect(twilioCreateMock.mock.calls[0][0]).toMatchObject({ to: "+14155552671" });
  });
});
