import { z } from "zod";

// Validate required environment variables
const envSchema = z.object({
  PORT: z.string().default("4900"),
  LOG_LEVEL: z.string().default("info"),
  
  // Kafka
  KAFKA_BROKERS: z.string(),
  KAFKA_CLIENT_ID: z.string().default("whatsapp-webhook-worker"),
  KAFKA_GROUP_ID: z.string().default("whatsapp-webhook-worker-group"),
  WEBHOOK_TOPIC: z.string().default("whatsapp.webhook.inbound"),
  WEBHOOK_PROCESSED_TOPIC: z.string().default("whatsapp.webhook.processed"),
  WEBHOOK_DLQ_TOPIC: z.string().default("whatsapp.webhook.dlq"),
  
  // Redis
  REDIS_URL: z.string(),
  
  // Supabase
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  // WhatsApp
  WHATSAPP_APP_SECRET: z.string().optional(),
  // Allow unsigned webhooks (for internal forwarding or testing)
  WA_ALLOW_UNSIGNED_WEBHOOKS: z.string().default("false"),

  // OpenAI - MANDATORY: Use GPT-5 model
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL: z.string().default("gpt-5"),
  OPENAI_BASE_URL: z.string().optional(),

  // Worker Config
  MAX_RETRIES: z.string().default("3").transform(Number),
  RETRY_DELAY_MS: z.string().default("1000").transform(Number),
  CONCURRENT_MESSAGES: z.string().default("10").transform(Number),
});

export type Config = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);
