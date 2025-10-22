process.env.TWILIO_MEDIA_AUTH_TOKEN = "token";
process.env.TWILIO_ACCOUNT_SID = "AC123";
process.env.TWILIO_AUTH_TOKEN = "secret";
process.env.TWILIO_OUTBOUND_CALLER_ID = "+12025550123";
process.env.TWILIO_MEDIA_STREAM_WSS = "wss://example.com/twilio-media";
process.env.OPENAI_REALTIME_URL = "wss://example.com";
process.env.OPENAI_REALTIME_API_KEY = "key";
process.env.KAFKA_BROKERS = "localhost:9092";
process.env.KAFKA_CLIENT_ID = "voice-bridge";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.BACKEND_SESSION_URL = "https://backend.example.com/session";
process.env.BRIDGE_SHARED_SECRET = "shared-secret";

import { settings } from "../src/config";

describe("config", () => {
  it("parses environment variables", () => {
    expect(settings.twilio.token).toBe("token");
    expect(settings.kafka.brokers).toEqual(["localhost:9092"]);
  });
});
