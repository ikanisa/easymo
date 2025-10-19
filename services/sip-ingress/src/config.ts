import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  PORT: z.coerce.number().default(4200),
  LOG_LEVEL: z.string().default("info"),
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default("sip-ingress"),
  EVENT_TOPIC: z.string().default("voice.sip.events"),
  CONTACT_TOPIC: z.string().default("voice.contact.events"),
  REDIS_URL: z.string().min(1),
  SIGNATURE_SECRET: z.string().optional(),
});

const parsed = schema.parse(process.env);

export const settings = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  kafka: {
    brokers: parsed.KAFKA_BROKERS.split(",").map((item) => item.trim()).filter(Boolean),
    clientId: parsed.KAFKA_CLIENT_ID,
    eventTopic: parsed.EVENT_TOPIC,
    contactTopic: parsed.CONTACT_TOPIC,
  },
  redisUrl: parsed.REDIS_URL,
  signatureSecret: parsed.SIGNATURE_SECRET,
};
