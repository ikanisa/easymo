/**
 * AI Provider Factory
 * 
 * Provides unified access to AI providers with fallback support.
 * Primary: Gemini 2.5 Pro
 * Secondary: OpenAI GPT-5
 */

import { GeminiProvider } from "./gemini.ts";
import { OpenAIProvider } from "./openai.ts";
import { logStructuredEvent } from "../../../_shared/observability.ts";

// =====================================================
// TYPES
// =====================================================

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  name: string;
  model: string;
  chat(messages: Message[], config?: ChatConfig): Promise<string>;
  stream?(messages: Message[], config?: ChatConfig): AsyncIterable<string>;
}

export type ProviderType = "gemini" | "openai";

// =====================================================
// FACTORY
// =====================================================

export class AIProviderFactory {
  private static geminiInstance: GeminiProvider | null = null;
  private static openaiInstance: OpenAIProvider | null = null;

  /**
   * Get an AI provider instance
   * Uses lazy initialization and caching for performance
   */
  static getProvider(preferred?: ProviderType): AIProvider {
    const provider = preferred ?? 
      (Deno.env.get("DEFAULT_AI_PROVIDER") as ProviderType | undefined) ?? 
      "gemini";
    
    if (provider === "openai") {
      return AIProviderFactory.getOpenAIProvider();
    }
    return AIProviderFactory.getGeminiProvider();
  }

  /**
   * Get Gemini provider instance (cached)
   */
  private static getGeminiProvider(): GeminiProvider {
    if (!AIProviderFactory.geminiInstance) {
      AIProviderFactory.geminiInstance = new GeminiProvider();
    }
    return AIProviderFactory.geminiInstance;
  }

  /**
   * Get OpenAI provider instance (cached)
   */
  private static getOpenAIProvider(): OpenAIProvider {
    if (!AIProviderFactory.openaiInstance) {
      AIProviderFactory.openaiInstance = new OpenAIProvider();
    }
    return AIProviderFactory.openaiInstance;
  }

  /**
   * Execute with automatic fallback
   * 
   * Tries primary provider (Gemini) first, falls back to secondary (OpenAI)
   * on failure. Logs fallback events for monitoring.
   * 
   * @param fn Function that takes a provider and returns a response
   * @returns The response from the first successful provider
   */
  static async withFallback(
    fn: (provider: AIProvider) => Promise<string>
  ): Promise<string> {
    const fallbackEnabled = Deno.env.get("AI_FALLBACK_ENABLED") !== "false";
    
    try {
      return await fn(AIProviderFactory.getGeminiProvider());
    } catch (error) {
      if (!fallbackEnabled) {
        throw error;
      }

      await logStructuredEvent("AI_PROVIDER_FALLBACK", {
        primary: "gemini",
        secondary: "openai",
        error: error instanceof Error ? error.message : String(error),
      }, "warn");

      try {
        return await fn(AIProviderFactory.getOpenAIProvider());
      } catch (fallbackError) {
        await logStructuredEvent("AI_PROVIDER_FALLBACK_FAILED", {
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        }, "error");
        throw fallbackError;
      }
    }
  }

  /**
   * Get information about available providers
   */
  static getProviderInfo(): {
    primary: string;
    secondary: string;
    defaultProvider: ProviderType;
    fallbackEnabled: boolean;
  } {
    return {
      primary: "gemini-2.5-pro",
      secondary: "gpt-5",
      defaultProvider: (Deno.env.get("DEFAULT_AI_PROVIDER") as ProviderType) ?? "gemini",
      fallbackEnabled: Deno.env.get("AI_FALLBACK_ENABLED") !== "false",
    };
  }
}

// Re-export provider classes for direct use
export { GeminiProvider } from "./gemini.ts";
export { OpenAIProvider } from "./openai.ts";
