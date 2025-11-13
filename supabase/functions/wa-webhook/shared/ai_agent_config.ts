/**
 * AI Agent Configuration
 *
 * Centralized configuration for all AI agent features
 * Allows feature flags and dynamic configuration
 */

import { logStructuredEvent } from "../observe/log.ts";

export interface AIAgentConfig {
  enabled: boolean;
  version: string;
  
  // Model configuration
  model: {
    provider: "openai";
    defaultModel: string;
    fallbackModel: string;
    temperature: number;
    maxTokens: number;
    seed?: number;
  };
  
  // Memory configuration
  memory: {
    shortTerm: {
      enabled: boolean;
      maxMessages: number;
      ttlSeconds: number;
    };
    longTerm: {
      enabled: boolean;
      embeddingModel: string;
      similarityThreshold: number;
      topK: number;
    };
    working: {
      enabled: boolean;
      ttlSeconds: number;
    };
  };
  
  // Tools configuration
  tools: {
    enabled: boolean;
    builtinTools: string[];
    externalTools: {
      webSearch: boolean;
      deepResearch: boolean;
      weather: boolean;
      currencyConversion: boolean;
    };
    maxExecutionTime: number;
  };
  
  // Rate limiting
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    blacklistThreshold: number;
    blacklistDuration: number;
  };
  
  // Connection pool
  connectionPool: {
    enabled: boolean;
    minSize: number;
    maxSize: number;
    acquireTimeout: number;
    idleTimeout: number;
  };
  
  // Cache configuration
  cache: {
    enabled: boolean;
    defaultTTL: number;
    maxSize: number;
    checkPeriod: number;
  };
  
  // Monitoring
  monitoring: {
    enabled: boolean;
    logLevel: "debug" | "info" | "warn" | "error";
    trackTokenUsage: boolean;
    trackCosts: boolean;
    trackLatency: boolean;
  };
  
  // Security
  security: {
    webhookVerification: boolean;
    inputValidation: boolean;
    outputSanitization: boolean;
    piiMasking: boolean;
  };
  
  // Agent types
  agentTypes: {
    [key: string]: {
      enabled: boolean;
      systemPrompt: string;
      allowedTools: string[];
      maxConversationLength: number;
    };
  };
}

/**
 * Default configuration
 */
export const defaultAIAgentConfig: AIAgentConfig = {
  enabled: Deno.env.get("AI_AGENTS_ENABLED") === "true",
  version: "2.0.0",
  
  model: {
    provider: "openai",
    defaultModel: "gpt-4o-mini",
    fallbackModel: "gpt-3.5-turbo",
    temperature: 0.7,
    maxTokens: 1000,
    seed: undefined,
  },
  
  memory: {
    shortTerm: {
      enabled: true,
      maxMessages: 20,
      ttlSeconds: 3600, // 1 hour
    },
    longTerm: {
      enabled: true,
      embeddingModel: "text-embedding-3-small",
      similarityThreshold: 0.7,
      topK: 5,
    },
    working: {
      enabled: true,
      ttlSeconds: 1800, // 30 minutes
    },
  },
  
  tools: {
    enabled: true,
    builtinTools: [
      "check_wallet_balance",
      "search_trips",
      "get_user_profile",
      "initiate_transfer",
    ],
    externalTools: {
      webSearch: Deno.env.get("TAVILY_API_KEY") !== undefined,
      deepResearch: Deno.env.get("PERPLEXITY_API_KEY") !== undefined,
      weather: Deno.env.get("OPENWEATHER_API_KEY") !== undefined,
      currencyConversion: true, // Uses free API
    },
    maxExecutionTime: 10000, // 10 seconds
  },
  
  rateLimit: {
    enabled: true,
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    blacklistThreshold: 10,
    blacklistDuration: 3600000, // 1 hour
  },
  
  connectionPool: {
    enabled: true,
    minSize: 5,
    maxSize: 20,
    acquireTimeout: 5000,
    idleTimeout: 300000, // 5 minutes
  },
  
  cache: {
    enabled: true,
    defaultTTL: 300, // 5 minutes
    maxSize: 1000,
    checkPeriod: 600, // 10 minutes
  },
  
  monitoring: {
    enabled: true,
    logLevel: (Deno.env.get("LOG_LEVEL") as any) || "info",
    trackTokenUsage: true,
    trackCosts: true,
    trackLatency: true,
  },
  
  security: {
    webhookVerification: true,
    inputValidation: true,
    outputSanitization: true,
    piiMasking: true,
  },
  
  agentTypes: {
    customer_service: {
      enabled: true,
      systemPrompt: `You are a helpful customer service assistant for EasyMO, a mobility platform in Rwanda.
Be empathetic, professional, and concise.
Always respond in the user's preferred language.
Keep responses under 3 sentences unless more detail is requested.`,
      allowedTools: [
        "check_wallet_balance",
        "search_trips",
        "get_user_profile",
        "web_search",
      ],
      maxConversationLength: 20,
    },
    
    booking: {
      enabled: true,
      systemPrompt: `You are a booking assistant for EasyMO.
Help users find and book transportation.
Be clear about prices, times, and locations.
Confirm all booking details before proceeding.
Keep responses under 3 sentences.`,
      allowedTools: [
        "search_trips",
        "get_user_profile",
        "check_wallet_balance",
      ],
      maxConversationLength: 15,
    },
    
    payment: {
      enabled: true,
      systemPrompt: `You are a payment assistant for EasyMO.
Help users with wallet operations and transfers.
Always confirm amounts and recipients before proceeding.
Be clear about fees and processing times.
Keep responses under 3 sentences.`,
      allowedTools: [
        "check_wallet_balance",
        "initiate_transfer",
        "get_user_profile",
        "convert_currency",
      ],
      maxConversationLength: 10,
    },
    
    general: {
      enabled: true,
      systemPrompt: `You are a helpful assistant for EasyMO.
Provide general information and assistance.
If you don't know something, be honest and offer to connect the user with support.
Keep responses under 2-3 sentences.`,
      allowedTools: [
        "get_user_profile",
        "web_search",
        "get_weather",
      ],
      maxConversationLength: 20,
    },
  },
};

/**
 * Get AI agent configuration
 * Can be overridden by database settings or environment variables
 */
export async function getAIAgentConfig(): Promise<AIAgentConfig> {
  try {
    // TODO: Fetch from database if available
    // For now, return default config
    
    await logStructuredEvent("AI_AGENT_CONFIG_LOADED", {
      version: defaultAIAgentConfig.version,
      enabled: defaultAIAgentConfig.enabled,
      model: defaultAIAgentConfig.model.defaultModel,
    });
    
    return defaultAIAgentConfig;
  } catch (error) {
    console.error("Failed to load AI agent config:", error);
    return defaultAIAgentConfig;
  }
}

/**
 * Validate configuration
 */
export function validateAIAgentConfig(config: AIAgentConfig): boolean {
  if (!config.model.defaultModel) {
    console.error("Default model not configured");
    return false;
  }
  
  if (config.connectionPool.minSize > config.connectionPool.maxSize) {
    console.error("Connection pool minSize cannot exceed maxSize");
    return false;
  }
  
  if (config.rateLimit.blacklistThreshold < 1) {
    console.error("Blacklist threshold must be at least 1");
    return false;
  }
  
  return true;
}

/**
 * Get agent-specific configuration
 */
export function getAgentTypeConfig(
  config: AIAgentConfig,
  agentType: string
): AIAgentConfig["agentTypes"][string] | null {
  const agentConfig = config.agentTypes[agentType];
  
  if (!agentConfig || !agentConfig.enabled) {
    return null;
  }
  
  return agentConfig;
}
