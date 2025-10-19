import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  PORT: z.coerce.number().default(4300),
  LOG_LEVEL: z.string().default("info"),
  META_VERIFY_TOKEN: z.string().min(1),
  META_PAGE_TOKEN: z.string().min(1),
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default("whatsapp-bot"),
  INBOUND_TOPIC: z.string().default("whatsapp.inbound"),
  OUTBOUND_TOPIC: z.string().default("whatsapp.outbound"),
  REDIS_URL: z.string().min(1),
  OPT_OUT_PATTERN: z.string().default("\\bSTOP\\b"),
});

const parsed = schema.parse(process.env);

export const settings = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  meta: {
    verifyToken: parsed.META_VERIFY_TOKEN,
    pageToken: parsed.META_PAGE_TOKEN,
  },
  kafka: {
    brokers: parsed.KAFKA_BROKERS.split(",").map((item) => item.trim()).filter(Boolean),
    clientId: parsed.KAFKA_CLIENT_ID,
    inboundTopic: parsed.INBOUND_TOPIC,
    outboundTopic: parsed.OUTBOUND_TOPIC,
  },
  redisUrl: parsed.REDIS_URL,
  optOutRegex: new RegExp(parsed.OPT_OUT_PATTERN, "i"),
};
