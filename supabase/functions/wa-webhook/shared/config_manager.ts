/**
 * Configuration Manager for AI Agents
 *
 * Centralized configuration management with:
 * - Environment variable parsing
 * - Type-safe defaults
 * - Runtime configuration
 * - Feature flag support
 *
 * ADDITIVE ONLY - New file, doesn't modify existing code
 */

export interface AIAgentConfig {
  // Feature Control
  enabled: boolean;
  streamingEnabled: boolean;
  
  // OpenAI Settings
  model: string;
  temperature: number;
  maxTokens: number;
  seed?: number;
  
  // Rate Limiting
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  rateLimitBlacklistThreshold: number;
  rateLimitBlacklistDuration: number;
  
  // Memory Settings
  memoryWindowMessages: number;
  memoryShortTermTTL: number;
  memoryCacheEnabled: boolean;
  
  // Tool Settings
  enabledTools: string[];
  toolExecutionTimeout: number;
  
  // Performance
  cacheEnabled: boolean;
  cacheTTL: number;
  cacheMaxSize: number;
  connectionPoolEnabled: boolean;
  
  // Monitoring
  logLevel: "debug" | "info" | "warn" | "error";
  metricsEnabled: boolean;
  detailedLogging: boolean;
  
  // Security
  webhookVerificationEnabled: boolean;
  signatureCacheEnabled: boolean;
  piiMaskingEnabled: boolean;
}

/**
 * Get AI Agent configuration from environment
 */
export function getAIAgentConfig(): AIAgentConfig {
  return {
    // Feature Control
    enabled: Deno.env.get("ENABLE_AI_AGENTS") === "true",
    streamingEnabled: Deno.env.get("ENABLE_STREAMING") === "true",
    
    // OpenAI Settings
    model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
    temperature: parseFloat(Deno.env.get("OPENAI_TEMPERATURE") || "0.7"),
    maxTokens: parseInt(Deno.env.get("OPENAI_MAX_TOKENS") || "1000"),
    seed: Deno.env.get("OPENAI_SEED") 
      ? parseInt(Deno.env.get("OPENAI_SEED")!) 
      : undefined,
    
    // Rate Limiting
    rateLimitPerMinute: parseInt(Deno.env.get("AI_RATE_LIMIT_MINUTE") || "10"),
    rateLimitPerHour: parseInt(Deno.env.get("AI_RATE_LIMIT_HOUR") || "100"),
    rateLimitBlacklistThreshold: parseInt(
      Deno.env.get("AI_RATE_LIMIT_BLACKLIST_THRESHOLD") || "10"
    ),
    rateLimitBlacklistDuration: parseInt(
      Deno.env.get("AI_RATE_LIMIT_BLACKLIST_DURATION") || "3600000"
    ), // 1 hour
    
    // Memory Settings
    memoryWindowMessages: parseInt(Deno.env.get("AI_MEMORY_WINDOW") || "20"),
    memoryShortTermTTL: parseInt(Deno.env.get("AI_MEMORY_TTL") || "3600"), // 1 hour
    memoryCacheEnabled: Deno.env.get("AI_MEMORY_CACHE") !== "false",
    
    // Tool Settings
    enabledTools: (Deno.env.get("AI_ENABLED_TOOLS") || "check_wallet_balance,search_trips,get_user_profile,initiate_transfer")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean),
    toolExecutionTimeout: parseInt(Deno.env.get("AI_TOOL_TIMEOUT") || "10000"), // 10s
    
    // Performance
    cacheEnabled: Deno.env.get("AI_CACHE_ENABLED") !== "false",
    cacheTTL: parseInt(Deno.env.get("AI_CACHE_TTL") || "300"), // 5 minutes
    cacheMaxSize: parseInt(Deno.env.get("AI_CACHE_MAX_SIZE") || "1000"),
    connectionPoolEnabled: Deno.env.get("AI_CONNECTION_POOL") === "true",
    
    // Monitoring
    logLevel: (Deno.env.get("AI_LOG_LEVEL") || "info") as "debug" | "info" | "warn" | "error",
    metricsEnabled: Deno.env.get("AI_METRICS_ENABLED") !== "false",
    detailedLogging: Deno.env.get("AI_DETAILED_LOGGING") === "true",
    
    // Security
    webhookVerificationEnabled: Deno.env.get("WEBHOOK_VERIFICATION") !== "false",
    signatureCacheEnabled: Deno.env.get("SIGNATURE_CACHE") !== "false",
    piiMaskingEnabled: Deno.env.get("PII_MASKING") === "true",
  };
}

/**
 * Validate configuration
 */
export function validateAIConfig(config: AIAgentConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Temperature validation
  if (config.temperature < 0 || config.temperature > 2) {
    errors.push("Temperature must be between 0 and 2");
  }

  // Max tokens validation
  if (config.maxTokens < 1 || config.maxTokens > 4096) {
    errors.push("Max tokens must be between 1 and 4096");
  }

  // Rate limit validation
  if (config.rateLimitPerMinute < 1) {
    errors.push("Rate limit per minute must be at least 1");
  }

  if (config.rateLimitPerHour < config.rateLimitPerMinute) {
    errors.push("Hourly rate limit must be >= minute rate limit");
  }

  // Memory validation
  if (config.memoryWindowMessages < 1 || config.memoryWindowMessages > 100) {
    errors.push("Memory window must be between 1 and 100 messages");
  }

  // Cache validation
  if (config.cacheMaxSize < 100) {
    errors.push("Cache max size must be at least 100");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration summary for logging
 */
export function getConfigSummary(config: AIAgentConfig): Record<string, any> {
  return {
    enabled: config.enabled,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    rateLimits: {
      perMinute: config.rateLimitPerMinute,
      perHour: config.rateLimitPerHour,
    },
    memory: {
      window: config.memoryWindowMessages,
      cacheEnabled: config.memoryCacheEnabled,
    },
    tools: {
      enabled: config.enabledTools,
      count: config.enabledTools.length,
    },
    performance: {
      cacheEnabled: config.cacheEnabled,
      poolEnabled: config.connectionPoolEnabled,
    },
  };
}

/**
 * Singleton instance
 */
let configInstance: AIAgentConfig | null = null;

export function getConfig(): AIAgentConfig {
  if (!configInstance) {
    configInstance = getAIAgentConfig();
    
    // Validate on first load
    const validation = validateAIConfig(configInstance);
    if (!validation.valid) {
      console.error("AI Agent configuration errors:", validation.errors);
      throw new Error(`Invalid AI Agent configuration: ${validation.errors.join(", ")}`);
    }
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}
