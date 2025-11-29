/**
 * EasyMO AI Package
 * 
 * Comprehensive AI infrastructure for EasyMO.
 */

// Core exports
export { AgentOrchestrator } from './core/orchestrator';

// Unified Provider exports
export {
  calculateCost,
  createUnifiedProvider,
  type IUnifiedAIProvider,
  type MultiModalContent,
  type MultiModalMessage,
  type ProviderHealthStatus,
  selectCostEffectiveModel,
  UnifiedAIProvider,
  type UnifiedChatConfig,
  type UnifiedChatResponse,
  type UnifiedMessage,
  type UnifiedProviderConfig,
  type UnifiedStreamChunk,
  type UnifiedTokenUsage,
  type UnifiedToolCall,
  type UnifiedToolDefinition,
} from './core/unified-provider';

// LLM Provider exports
export {
  createGeminiProvider,
  GeminiProvider,
  type GeminiProviderConfig,
} from './llm/gemini-provider';
export { type OpenAIConfig,OpenAIProvider } from './llm/openai-provider';

// Tool registry exports
export {
  ALL_TOOLS,
  getAllToolNames,
  getAllToolSchemas,
  getTool,
  getToolsByCategory,
  getToolSchema,
  TOOL_REGISTRY,
  toolExists,
} from './tools';

// Voice tool exports
export {
  generateSpeech,
  getVoiceToolSchemas,
  transcribeAudio,
  type TranscriptionResult,
  type TTSInput,
  type TTSResult,
  ttsTool,
  type TTSVoice,
  VOICE_TOOLS,
  type WhisperInput,
  whisperTool,
} from './tools/voice';

// Image generation exports
export {
  type AspectRatio,
  generateImage,
  generateSingleImage,
  getImageToolSchemas,
  IMAGE_TOOLS,
  type ImageGenerationResult,
  type ImagenInput,
  imagenTool,
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
export * from "./agents/openai/agent-definitions";
export { default as RealtimeClient } from "./agents/openai/realtime-client";
export { default as OpenAIResponsesAPI } from "./agents/openai/responses-api";
export { default as OpenAIAgentsSDK } from "./agents/openai/sdk-client";
export * from "./agents/openai/tools";

// Google AI ADK
export { default as GoogleADKClient } from "./agents/google/adk-client";
export { default as FlashLiteClient } from "./agents/google/flash-lite";
export { default as GeminiLiveClient } from "./agents/google/gemini-live";
export { default as ImagenClient } from "./agents/google/imagen";
export { default as SearchGroundingClient } from "./agents/google/search-grounding";

// Core Infrastructure
export { default as AgentFactory } from "./core/agent-factory";
export * from "./core/types";
export { default as UnifiedGateway } from "./core/unified-gateway";
