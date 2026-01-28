import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load environment variables from a custom path
 * Allows each script to specify its own .env location
 */
export function loadEnv(envPath?: string): void {
  const resolvedPath = envPath || path.resolve(__dirname, "../../.env");
  dotenv.config({ path: resolvedPath });
}

/**
 * Create a typed config loader with Zod schema validation
 */
export function createConfig<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  type ConfigType = z.infer<typeof schema>;
  
  let config: ConfigType;
  
  try {
    config = schema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Configuration error:");
      for (const issue of error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exit(1);
    }
    throw error;
  }
  
  return config;
}

/**
 * Common config schema for Supabase connections
 */
export const baseSupabaseConfigSchema = z.object({
  // Source/Old System
  SOURCE_SUPABASE_URL: z.string().url().optional(),
  SOURCE_SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
  OLD_SUPABASE_URL: z.string().url().optional(),
  OLD_SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
  
  // Target/New System
  TARGET_SUPABASE_URL: z.string().url().optional(),
  TARGET_SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
  NEW_SUPABASE_URL: z.string().url().optional(),
  NEW_SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
  
  // Options
  DRY_RUN: z.coerce.boolean().default(false),
  VERBOSE: z.coerce.boolean().default(false),
});

export type BaseSupabaseConfig = z.infer<typeof baseSupabaseConfigSchema>;
