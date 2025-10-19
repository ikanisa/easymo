process.env.META_VERIFY_TOKEN = "token";
process.env.META_PAGE_TOKEN = "page";
process.env.KAFKA_BROKERS = "localhost:9092";
process.env.REDIS_URL = "redis://localhost:6379";

import { settings } from "../src/config";

describe("whatsapp config", () => {
  it("parses opt-out regex", () => {
    expect(settings.optOutRegex.test("STOP"));
  });
});
