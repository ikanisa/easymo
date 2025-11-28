/**
 * @easymo/ai - AI Agent Orchestration System
 * 
 * Central package for managing AI agents, tools, memory, and conversations
 * across the EasyMO platform.
 * 
 * @packageDocumentation
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

// Unified interface exports for orchestrator consolidation
export type {
  // Orchestrator interfaces
  IAgentOrchestrator,
  OrchestratorAgentType,
  ProcessMessageParams as UnifiedProcessMessageParams,
  IntentResult,
  OrchestratorResponse,
  // Provider interfaces
  IAIProvider,
  ProviderMessage,
  ProviderToolDefinition,
  ProviderToolCall,
  ProviderChatOptions,
  ProviderChatResponse,
  FallbackProviderConfig,
  ProviderFactory,
  // Agent configuration
  AgentConfiguration,
  AgentInteractionMetrics,
} from './core/interfaces';

// Gemini Live API exports
export {
  connectLiveSession,
  disconnectLiveSession,
  findLeads,
  searchLocalBusinesses,
  chatWithStrategist,
  chatFast,
  transcribeAudioFile,
  type LiveSessionCallbacks,
} from './providers-gemini-live';
