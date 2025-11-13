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
  TOOL_REGISTRY,
  getTool,
  getToolsByCategory,
  getAllToolNames,
  toolExists,
  getToolSchema,
  getAllToolSchemas,
  // Individual tools
  checkBalanceTool,
  sendMoneyTool,
  checkAvailabilityTool,
  createBookingTool,
  getUserProfileTool,
  createTicketTool,
} from './tools';

// Type exports
export type {
  AgentType,
  ConversationStatus,
  MessageRole,
  Channel,
  AgentConfig,
  Conversation,
  Message,
  ToolCall,
  Tool,
  ToolHandler,
  ToolContext,
  AgentResponse,
  TokenUsage,
  ProcessMessageParams,
  ExecutionParams,
  OrchestratorConfig,
  MemoryEntry,
  Metric,
  ToolExecution,
} from './core/types';
