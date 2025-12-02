/**
 * Environment Configuration Module
 * Centralized environment variable management with validation
 */

// ============================================================================
// TYPES
// ============================================================================

export type Environment = "development" | "staging" | "production";

export type EnvConfig = {
  // Environment
  environment: Environment;
  isProduction: boolean;
  isDevelopment: boolean;
  
  // Supabase
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey: string;
  
  // WhatsApp
  waPhoneId: string;
  waToken: string;
  waAppSecret: string;
  waVerifyToken: string;
  waBotNumber: string;
  
  // Security
  allowUnsignedWebhooks: boolean;
  allowInternalForward: boolean;
  
  // Rate Limiting
  rateLimitEnabled: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
  
  // Features
  inlineOcrEnabled: boolean;
  aiAgentsEnabled: boolean;
  
  // Logging
  logLevel: "debug" | "info" | "warn" | "error";
};

// ============================================================================
// ENVIRONMENT LOADER
// ============================================================================

class EnvLoader {
  private cache: EnvConfig | null = null;

  /**
   * Get environment variable with fallbacks
   */
  private get(primaryKey: string, ...fallbackKeys: string[]): string | undefined {
    let value = Deno.env.get(primaryKey);
    if (value) return value;
    
    for (const key of fallbackKeys) {
      value = Deno.env.get(key);
      if (value) return value;
    }
    
    return undefined;
  }

  /**
   * Get required environment variable
   */
  private require(primaryKey: string, ...fallbackKeys: string[]): string {
    const value = this.get(primaryKey, ...fallbackKeys);
    if (!value) {
      throw new Error(`Missing required environment variable: ${primaryKey} (or ${fallbackKeys.join(", ")})`);
    }
    return value;
  }

  /**
   * Get boolean environment variable
   */
  private getBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.get(key);
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === "true" || value === "1";
  }

  /**
   * Get number environment variable
   */
  private getNumber(key: string, defaultValue: number): number {
    const value = this.get(key);
    if (value === undefined) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Load and validate all environment variables
   */
  load(): EnvConfig {
    if (this.cache) return this.cache;

    const environment = (this.get("ENVIRONMENT", "NODE_ENV") || "development") as Environment;

    this.cache = {
      // Environment
      environment,
      isProduction: environment === "production",
      isDevelopment: environment === "development",

      // Supabase
      supabaseUrl: this.require("SUPABASE_URL", "SERVICE_URL"),
      supabaseServiceRoleKey: this.require(
        "SUPABASE_SERVICE_ROLE_KEY",
        "SERVICE_ROLE_KEY",
        "WA_SUPABASE_SERVICE_ROLE_KEY"
      ),
      supabaseAnonKey: this.get("SUPABASE_ANON_KEY") || "",

      // WhatsApp
      waPhoneId: this.require("WA_PHONE_ID", "WHATSAPP_PHONE_NUMBER_ID"),
      waToken: this.require("WA_TOKEN", "WHATSAPP_ACCESS_TOKEN"),
      waAppSecret: this.require("WA_APP_SECRET", "WHATSAPP_APP_SECRET"),
      waVerifyToken: this.require("WA_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN"),
      waBotNumber: this.get("WA_BOT_NUMBER_E164", "WHATSAPP_PHONE_NUMBER_E164") || "",

      // Security
      allowUnsignedWebhooks: this.getBoolean("WA_ALLOW_UNSIGNED_WEBHOOKS", false),
      allowInternalForward: this.getBoolean("WA_ALLOW_INTERNAL_FORWARD", false),

      // Rate Limiting
      rateLimitEnabled: this.getBoolean("ENABLE_RATE_LIMITING", true),
      rateLimitWindow: this.getNumber("RATE_LIMIT_WINDOW_MS", 60000),
      rateLimitMax: this.getNumber("RATE_LIMIT_MAX_REQUESTS", 100),

      // Features
      inlineOcrEnabled: this.getBoolean("INSURANCE_INLINE_OCR", true),
      aiAgentsEnabled: this.getBoolean("ENABLE_AI_AGENTS", false),

      // Logging
      logLevel: (this.get("LOG_LEVEL") || "info") as EnvConfig["logLevel"],
    };

    // Validate production settings
    if (this.cache.isProduction) {
      if (this.cache.allowUnsignedWebhooks) {
        console.warn("⚠️ SECURITY WARNING: WA_ALLOW_UNSIGNED_WEBHOOKS is true in production!");
      }
    }

    return this.cache;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache = null;
  }
}

// Singleton instance
const envLoader = new EnvLoader();

/**
 * Get environment configuration
 */
export function getEnv(): EnvConfig {
  return envLoader.load();
}

/**
 * Validate environment and throw if invalid
 */
export function validateEnv(): void {
  try {
    envLoader.load();
    console.log("✅ Environment configuration validated");
  } catch (error) {
    console.error("❌ Environment validation failed:", error);
    throw error;
  }
}

export { envLoader };
