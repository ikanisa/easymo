process.env.KAFKA_BROKERS = "localhost:9092";
process.env.REDIS_URL = "redis://localhost:6379";

import { settings } from "../src/config";

describe("sip config", () => {
  it("builds brokers list", () => {
    expect(settings.kafka.brokers).toEqual(["localhost:9092"]);
  });
});
