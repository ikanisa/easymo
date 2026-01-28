import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const configSchema = z.object({
  // Source (Ibimina)
  SOURCE_SUPABASE_URL: z.string().url(),
  SOURCE_SUPABASE_SERVICE_KEY: z.string().min(1),
  
  // Target (EasyMO)
  TARGET_SUPABASE_URL: z.string().url(),
  TARGET_SUPABASE_SERVICE_KEY: z.string().min(1),
  
  // Encryption
  PII_ENCRYPTION_KEY: z.string().min(32, "PII_ENCRYPTION_KEY must be at least 32 characters"),
  
  // Options
  BATCH_SIZE: z.coerce.number().default(100),
  DRY_RUN: z.coerce.boolean().default(false),
  VERBOSE: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;

let config: Config;

try {
  config = configSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Configuration error:");
    for (const issue of error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  throw error;
}

export { config };
