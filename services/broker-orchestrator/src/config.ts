import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  LOG_LEVEL: z.string().default("info"),
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default("broker-orchestrator"),
  WHATSAPP_TOPIC: z.string().default("whatsapp.inbound"),
  VOICE_CONTACT_TOPIC: z.string().default("voice.contact.events"),
  SIP_TOPIC: z.string().default("voice.sip.events"),
  BROKER_OUTBOUND_TOPIC: z.string().default("broker.outbound"),
  RETRY_TOPIC: z.string().default("broker.retry"),
  REDIS_URL: z.string().min(1),
  AGENT_CORE_URL: z.string().url().default("http://agent-core:4000"),
  WALLET_SERVICE_URL: z.string().optional(),
  WALLET_API_KEY: z.string().optional(),
});

const parsed = schema.parse(process.env);

export const settings = {
  logLevel: parsed.LOG_LEVEL,
  kafka: {
    brokers: parsed.KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean),
    clientId: parsed.KAFKA_CLIENT_ID,
    topics: {
      whatsapp: parsed.WHATSAPP_TOPIC,
      voiceContact: parsed.VOICE_CONTACT_TOPIC,
      sip: parsed.SIP_TOPIC,
      brokerOutbound: parsed.BROKER_OUTBOUND_TOPIC,
      retry: parsed.RETRY_TOPIC,
    },
  },
  redisUrl: parsed.REDIS_URL,
  agentCoreUrl: parsed.AGENT_CORE_URL,
  wallet: {
    url: parsed.WALLET_SERVICE_URL,
    apiKey: parsed.WALLET_API_KEY,
  },
};
