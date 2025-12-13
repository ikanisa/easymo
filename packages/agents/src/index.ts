/**
 * @easymo/agents - AI Agent Implementations
 * 
 * Official agent for EasyMO WhatsApp-first platform.
 * 
 * OFFICIAL AGENT:
 * - buy_and_sell - Buy & Sell AI Agent (marketplace, business discovery)
 */

// Core functionality
export type { AgentDefinition } from './runner';
export { runAgent } from './runner';

// Base Agent
export { BaseAgent } from './agents/base/agent.base';

// Buy & Sell Agent (THE ONLY AGENT)
export { BuyAndSellAgent, runBuyAndSellAgent } from './agents/commerce/buy-and-sell.agent';

// Tools (keep only those needed for Buy & Sell)
export {
  vectorSearchTool,
  webSearchTool,
} from './tools';

// Types
export type {
  AgentConfig,
  AgentContext,
  AgentInput,
  AgentResult,
  AgentTrace,
  ToolDefinition,
} from './types';

// Observability
export {
  logAgentComplete,
  logAgentError,
  logAgentHandoff,
  logAgentStart,
  logStructuredEvent,
  logToolInvocation,
  recordMetric,
  storeAgentTrace,
} from './observability';

// Feature flags
export type { AgentFeatureFlag } from './feature-flags';
export {
  isAgentFeatureEnabled,
  requireAgentFeature,
} from './feature-flags';

// Config-Driven Agent Management
export {
  // Loader
  AgentConfigLoader,
  createAgentConfigLoader,
  getDefaultAgentConfigLoader,
  // Tool Factory
  buildRuntimeTools,
  // Telemetry
  logAgentMetric,
  logToolExecution,
  logMatchEvent,
  logExperimentResult,
  // Experiment Support
  getActiveExperiment,
  getExperimentAwareInstruction,
  // Service Catalog
  EASYMO_VERTICALS,
  SERVICE_CATALOG,
  detectVerticalFromQuery,
  isOutOfScope,
} from './config';

export type {
  // Database-driven types
  AiAgent,
  AiAgentPersona,
  AiAgentSystemInstruction,
  AiAgentTool,
  AiAgentTask,
  AiAgentKnowledgeBase,
  ResolvedAgentConfig,
  RuntimeTool,
  RuntimeToolContext,
  AgentMetricInput,
  ToolExecutionInput,
  MatchEventInput,
  ToolType,
  Channel,
  MatchType,
  AgentSlug,
} from './config';
