export default () => ({
  database: {
    url: process.env.DATABASE_URL,
  },
  redisUrl: process.env.REDIS_URL,
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    agentId: process.env.OPENAI_AGENT_ID ?? "",
    baseUrl: process.env.OPENAI_BASE_URL ?? "",
  },
  featureFlags: {
    agentChat: process.env.FEATURE_AGENT_CHAT ?? "1",
  },
});
