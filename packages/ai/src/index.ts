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

// Tool exports
export {
  ALL_TOOLS,
  checkAvailabilityTool,
  // Individual tools
  checkBalanceTool,
  createBookingTool,
  createTicketTool,
  getAllToolNames,
  getAllToolSchemas,
  getTool,
  getToolsByCategory,
  getToolSchema,
  getUserProfileTool,
  sendMoneyTool,
  TOOL_REGISTRY,
  toolExists,
} from './tools';

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
