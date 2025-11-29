/**
 * EasyMO AI Agents Architecture - Main Exports
 * Complete AI integration with OpenAI, Google Gemini, and domain agents
 */

// ============================================================================
// CORE CONFIGURATION & TYPES
// ============================================================================
export * from './config';
export * from './types';

// ============================================================================
// PROVIDER CLIENTS
// ============================================================================
export { getOpenAIClient, resetOpenAIClient } from "./providers/openai-client";
export { getGeminiClient, resetGeminiClient, GEMINI_MODELS } from "./providers/gemini-client";

// ============================================================================
// CHAT & ROUTING
// ============================================================================
export { routeChatRequest } from "./router";
export { sessionManager } from './session-manager';

// ============================================================================
// GOOGLE AI INTEGRATIONS
// ============================================================================
export * from "./google";

// ============================================================================
// OPENAI INTEGRATIONS
// ============================================================================
export * from './openai';

// ============================================================================
// TOOLS & AGENT EXECUTION
// ============================================================================
export * from "./tools";
export * from "./agent-executor";

// ============================================================================
// DOMAIN-SPECIFIC AGENTS
// ============================================================================
export * from './domain';

// ============================================================================
// INTEGRATIONS
// ============================================================================
export * from '../integrations/google-maps';

// ============================================================================
// RE-EXPORT LEGACY TYPES FOR COMPATIBILITY
// ============================================================================
export type {
  ChatCompletionRole,
  ChatCompletionMessage,
  ChatCompletionTool,
  ChatCompletionRequestOptions,
  ChatCompletionChoice,
  ChatCompletionUsage,
  ChatCompletionResponse,
  ChatCompletionErrorShape,
} from "./chat-completions";

// ============================================================================
// QUICK START HELPERS
// ============================================================================
import { routeChatRequest } from './router';
import { mobilityAgent, marketplaceAgent, supportAgent } from './domain';

/**
 * Quick chat - auto-routed to best provider
 */
export async function quickChat(message: string, provider?: 'openai' | 'gemini') {
  return routeChatRequest({
    messages: [{ role: 'user', content: message }],
    preferredProvider: provider,
  });
}

/**
 * Quick agent routing
 */
export async function quickAgent(message: string, domain: 'mobility' | 'marketplace' | 'support') {
  const agents = { mobility: mobilityAgent, marketplace: marketplaceAgent, support: supportAgent };
  return agents[domain].execute(message);
}
