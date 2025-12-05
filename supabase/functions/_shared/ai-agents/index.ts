/**
 * Shared AI Agents - Index
 * 
 * Central exports for all agent shared utilities.
 * All standalone agents import from here.
 */

// Base agent class
export { BaseAgent } from './base-agent.ts';
export type {
  AgentSession,
  ConversationMessage,
  AgentProcessParams,
  AgentResponse,
  AgentConfig,
  AgentTool,
} from './base-agent.ts';

// Agent collaboration
export {
  findBestAgent,
  getAllAgents,
  getAgentByType,
  consultAgent,
  recordCollaboration,
  buildAgentKnowledgeSummary,
} from './agent-collaboration.ts';
export type {
  AgentCapability,
  AgentRequest,
  AgentCollaboration,
} from './agent-collaboration.ts';

// AI Providers
export { GeminiProvider } from './providers/gemini.ts';
