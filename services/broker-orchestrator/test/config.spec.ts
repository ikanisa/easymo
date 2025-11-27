import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
process.env.KAFKA_BROKERS = "localhost:9092";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.AGENT_CORE_URL = "http://localhost:4000";

import { settings } from "../src/config";

describe("broker orchestrator config", () => {
  it("parses kafka brokers", () => {
    expect(settings.kafka.brokers).toEqual(["localhost:9092"]);
  });
});
