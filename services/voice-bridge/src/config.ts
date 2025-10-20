import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  PORT: z.coerce.number().default(4100),
  LOG_LEVEL: z.string().default("info"),
  TWILIO_MEDIA_AUTH_TOKEN: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_OUTBOUND_CALLER_ID: z.string().min(1),
  TWILIO_MEDIA_STREAM_WSS: z.string().min(1),
  TWILIO_STATUS_CALLBACK_URL: z.string().url().optional(),
  OPENAI_REALTIME_URL: z.string().url(),
  OPENAI_REALTIME_API_KEY: z.string().min(1),
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default("voice-bridge"),
  REDIS_URL: z.string().min(1),
  COMPLIANCE_PROMPT: z.string().default("This call may be monitored for quality and compliance."),
  OPT_OUT_PATTERN: z.string().default("\\b(STOP|END|CANCEL)\\b"),
  CONTACT_TOPIC: z.string().default("voice.contact.events"),
  MEDIA_TOPIC: z.string().default("voice.media.events"),
  BACKEND_SESSION_URL: z.string().url(),
  BRIDGE_SHARED_SECRET: z.string().min(1),
  DEFAULT_AGENT_PROFILE: z.string().default("sales"),
  SERVICE_AUTH_AUDIENCE: z.string().min(1).default("voice-bridge"),
  RATE_LIMIT_REDIS_URL: z.string().min(1).optional(),
  RATE_LIMIT_POINTS: z.coerce.number().min(1).default(300),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().min(1).default(60),
});

const parsed = schema.parse(process.env);

export const settings = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  twilio: {
    token: parsed.TWILIO_MEDIA_AUTH_TOKEN,
    optOutRegex: new RegExp(parsed.OPT_OUT_PATTERN, "i"),
    accountSid: parsed.TWILIO_ACCOUNT_SID,
    authToken: parsed.TWILIO_AUTH_TOKEN,
    outboundCallerId: parsed.TWILIO_OUTBOUND_CALLER_ID,
    mediaStreamWss: parsed.TWILIO_MEDIA_STREAM_WSS,
    statusCallbackUrl: parsed.TWILIO_STATUS_CALLBACK_URL,
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
  backend: {
    sessionUrl: parsed.BACKEND_SESSION_URL,
    sharedSecret: parsed.BRIDGE_SHARED_SECRET,
  },
  agent: {
    defaultProfile: parsed.DEFAULT_AGENT_PROFILE,
  },
  auth: {
    audience: parsed.SERVICE_AUTH_AUDIENCE,
  },
  rateLimit: {
    redisUrl: parsed.RATE_LIMIT_REDIS_URL,
    points: parsed.RATE_LIMIT_POINTS,
    windowSeconds: parsed.RATE_LIMIT_WINDOW_SECONDS,
  },
};
