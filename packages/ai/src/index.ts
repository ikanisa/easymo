/**
 * EasyMO AI Package
 * 
 * Comprehensive AI infrastructure for EasyMO.
 */

// Core exports
export { AgentOrchestrator } from './core/orchestrator';

// Unified Provider exports
export {
  UnifiedAIProvider,
  createUnifiedProvider,
  calculateCost,
  selectCostEffectiveModel,
  type IUnifiedAIProvider,
  type UnifiedMessage,
  type MultiModalContent,
  type MultiModalMessage,
  type UnifiedToolDefinition,
  type UnifiedToolCall,
  type UnifiedTokenUsage,
  type UnifiedChatConfig,
  type UnifiedChatResponse,
  type UnifiedStreamChunk,
  type ProviderHealthStatus,
  type UnifiedProviderConfig,
} from './core/unified-provider';

// LLM Provider exports
export { OpenAIProvider, type OpenAIConfig } from './llm/openai-provider';
export {
  GeminiProvider,
  createGeminiProvider,
  type GeminiProviderConfig,
} from './llm/gemini-provider';

// Tool registry exports
export {
  ALL_TOOLS,
  TOOL_REGISTRY,
  getTool,
  getToolsByCategory,
  getAllToolNames,
  toolExists,
  getToolSchema,
  getAllToolSchemas,
} from './tools';

// Voice tool exports
export {
  whisperTool,
  ttsTool,
  transcribeAudio,
  generateSpeech,
  VOICE_TOOLS,
  getVoiceToolSchemas,
  type TranscriptionResult,
  type TTSResult,
  type TTSVoice,
  type WhisperInput,
  type TTSInput,
} from './tools/voice';

// Image generation exports
export {
  imagenTool,
  generateImage,
  generateSingleImage,
  IMAGE_TOOLS,
  getImageToolSchemas,
  type ImageGenerationResult,
  type AspectRatio,
  type ImagenInput,
} from './tools/imagen';

// Type exports from core types
export type {
  AgentConfig,
  AgentResponse,
  AgentType,
  Channel,
  Conversation,
  ConversationStatus,
  ExecutionParams,
  MemoryEntry,
  Message,
  MessageRole,
  Metric,
  OrchestratorConfig,
  ProcessMessageParams,
  TokenUsage,
  Tool,
  ToolCall,
  ToolContext,
  ToolExecution,
  ToolHandler,
} from './core/types';
// OpenAI Agents SDK
export { default as OpenAIAgentsSDK } from "./agents/openai/sdk-client";
export { default as OpenAIResponsesAPI } from "./agents/openai/responses-api";
export { default as RealtimeClient } from "./agents/openai/realtime-client";
export * from "./agents/openai/agent-definitions";
export * from "./agents/openai/tools";

// Google AI ADK
export { default as GoogleADKClient } from "./agents/google/adk-client";
export { default as GeminiLiveClient } from "./agents/google/gemini-live";
export { default as FlashLiteClient } from "./agents/google/flash-lite";
export { default as SearchGroundingClient } from "./agents/google/search-grounding";
export { default as ImagenClient } from "./agents/google/imagen";

// Core Infrastructure
export { default as UnifiedGateway } from "./core/unified-gateway";
export { default as AgentFactory } from "./core/agent-factory";
export * from "./core/types";
