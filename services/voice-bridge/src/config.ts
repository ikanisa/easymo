import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  PORT: z.coerce.number().default(4100),
  LOG_LEVEL: z.string().default("info"),
  TWILIO_MEDIA_AUTH_TOKEN: z.string().min(1),
  OPENAI_REALTIME_URL: z.string().url(),
  OPENAI_REALTIME_API_KEY: z.string().min(1),
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default("voice-bridge"),
  REDIS_URL: z.string().min(1),
  COMPLIANCE_PROMPT: z.string().default("This call may be monitored for quality and compliance."),
  OPT_OUT_PATTERN: z.string().default("\\b(STOP|END|CANCEL)\\b"),
  CONTACT_TOPIC: z.string().default("voice.contact.events"),
  MEDIA_TOPIC: z.string().default("voice.media.events"),
});

const parsed = schema.parse(process.env);

export const settings = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  twilio: {
    token: parsed.TWILIO_MEDIA_AUTH_TOKEN,
    optOutRegex: new RegExp(parsed.OPT_OUT_PATTERN, "i"),
  },
  openai: {
    realtimeUrl: parsed.OPENAI_REALTIME_URL,
    apiKey: parsed.OPENAI_REALTIME_API_KEY,
  },
  kafka: {
    brokers: parsed.KAFKA_BROKERS.split(",").map((item) => item.trim()).filter(Boolean),
    clientId: parsed.KAFKA_CLIENT_ID,
    contactTopic: parsed.CONTACT_TOPIC,
    mediaTopic: parsed.MEDIA_TOPIC,
  },
  redisUrl: parsed.REDIS_URL,
  compliancePrompt: parsed.COMPLIANCE_PROMPT,
};
