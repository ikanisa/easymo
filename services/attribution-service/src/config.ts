import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  PORT: z.coerce.number().default(4900),
  LOG_LEVEL: z.string().default("info"),
  SERVICE_AUTH_AUDIENCE: z.string().min(1).default("attribution-service"),
  RATE_LIMIT_REDIS_URL: z.string().min(1).optional(),
  RATE_LIMIT_POINTS: z.coerce.number().min(1).default(120),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().min(1).default(60),
});

const parsed = schema.parse(process.env);

export const settings = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  auth: {
    audience: parsed.SERVICE_AUTH_AUDIENCE,
  },
  rateLimit: {
    redisUrl: parsed.RATE_LIMIT_REDIS_URL,
    points: parsed.RATE_LIMIT_POINTS,
    windowSeconds: parsed.RATE_LIMIT_WINDOW_SECONDS,
  },
};
