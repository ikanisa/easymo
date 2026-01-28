import { baseSupabaseConfigSchema,createConfig, loadEnv } from "@easymo/migration-shared/config";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.resolve(__dirname, "../.env"));

const goLiveConfigSchema = baseSupabaseConfigSchema.extend({
  // Override to make required
  OLD_SUPABASE_URL: z.string().url(),
  OLD_SUPABASE_SERVICE_KEY: z.string().min(1),
  NEW_SUPABASE_URL: z.string().url(),
  NEW_SUPABASE_SERVICE_KEY: z.string().min(1),
  
  // Portals
  OLD_VENDOR_PORTAL_URL: z.string().url().optional(),
  NEW_VENDOR_PORTAL_URL: z.string().url().optional(),
  
  // SMS
  SMS_GATEWAY_API_URL: z.string().url().optional(),
  SMS_GATEWAY_API_KEY: z.string().optional(),
  SMS_WEBHOOK_SECRET: z.string().optional(),
  
  // DNS/Routing
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  DOMAIN_NAME: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  
  // Alerting
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  SLACK_CHANNEL: z.string().default("#vendor-portal-alerts"),
  PAGERDUTY_ROUTING_KEY: z.string().optional(),
  
  // Feature Flags
  TRAFFIC_PERCENTAGE: z.coerce.number().min(0).max(100).default(0),
  PARALLEL_WRITE_ENABLED: z.coerce.boolean().default(false),
  READ_FROM_NEW_SYSTEM: z.coerce.boolean().default(false),
  
  // Monitoring
  METRICS_PUSH_GATEWAY: z.string().url().optional(),
  COMPARISON_INTERVAL_MS: z.coerce.number().default(60000),
  ALERT_THRESHOLD_ERROR_RATE: z.coerce.number().default(0.01),
  ALERT_THRESHOLD_LATENCY_MS: z.coerce.number().default(2000),
  
  // Options
  CUTOVER_DATETIME: z.string().optional(),
  ROLLBACK_WINDOW_HOURS: z.coerce.number().default(72),
});

export type Config = z.infer<typeof goLiveConfigSchema>;
export const config = createConfig(goLiveConfigSchema);
