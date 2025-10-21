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
  voiceBridgeUrl: process.env.VOICE_BRIDGE_URL ?? "",
  agentApi: {
    baseUrl: process.env.AGENT_API_URL ?? "",
  },
  tasks: {
    pollIntervalMs: Number(process.env.TASK_POLL_INTERVAL_MS ?? "60000"),
  },
  featureFlags: {
    agentChat: process.env.FEATURE_AGENT_CHAT ?? "1",
    agentWebSearch: process.env.FEATURE_AGENT_WEB_SEARCH ?? "0",
  },
  serviceAuth: {
    audience: process.env.SERVICE_AUTH_AUDIENCE ?? "agent-core",
  },
});
