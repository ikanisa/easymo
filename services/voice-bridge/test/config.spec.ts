process.env.TWILIO_MEDIA_AUTH_TOKEN = "token";
process.env.OPENAI_REALTIME_URL = "wss://example.com";
process.env.OPENAI_REALTIME_API_KEY = "key";
process.env.KAFKA_BROKERS = "localhost:9092";
process.env.REDIS_URL = "redis://localhost:6379";

import { settings } from "../src/config";

describe("config", () => {
  it("parses environment variables", () => {
    expect(settings.twilio.token).toBe("token");
    expect(settings.kafka.brokers).toEqual(["localhost:9092"]);
  });
});
