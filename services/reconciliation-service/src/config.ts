import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  PORT: z.coerce.number().default(5000),
  LOG_LEVEL: z.string().default("info"),
  DEFAULT_TENANT_ID: z.string().uuid().default("a4a8cf2d-0a4f-446c-8bf2-28509641158f"),
  WALLET_SERVICE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  RECON_SOURCE_ACCOUNT_ID: z.string().uuid(),
  SERVICE_AUTH_AUDIENCE: z.string().min(1).default("reconciliation-service"),
  RATE_LIMIT_REDIS_URL: z.string().min(1).optional(),
  RATE_LIMIT_POINTS: z.coerce.number().min(1).default(60),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().min(1).default(60),
});

const parsed = schema.parse(process.env);

export const settings = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  defaultTenantId: parsed.DEFAULT_TENANT_ID,
  walletServiceUrl: parsed.WALLET_SERVICE_URL,
  redisUrl: parsed.REDIS_URL,
  reconSourceAccountId: parsed.RECON_SOURCE_ACCOUNT_ID,
  auth: {
    audience: parsed.SERVICE_AUTH_AUDIENCE,
  },
  rateLimit: {
    redisUrl: parsed.RATE_LIMIT_REDIS_URL,
    points: parsed.RATE_LIMIT_POINTS,
    windowSeconds: parsed.RATE_LIMIT_WINDOW_SECONDS,
  },
};
