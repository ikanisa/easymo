import dotenv from "dotenv";
dotenv.config();

export const settings = {
  port: Number(process.env.PORT || 4001),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
  },
  env: process.env.NODE_ENV || "development",
};
