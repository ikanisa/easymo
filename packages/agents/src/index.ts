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
export type {
  AgentMetricInput,
  AgentSlug,
  // Database-driven types
  AiAgent,
  AiAgentKnowledgeBase,
  AiAgentPersona,
  AiAgentSystemInstruction,
  AiAgentTask,
  AiAgentTool,
  Channel,
  MatchEventInput,
  MatchType,
  ResolvedAgentConfig,
  RuntimeTool,
  RuntimeToolContext,
  ToolExecutionInput,
  ToolType,
} from './config';
export {
  // Loader
  AgentConfigLoader,
  // Tool Factory
  buildRuntimeTools,
  createAgentConfigLoader,
  detectVerticalFromQuery,
  // Service Catalog
  EASYMO_VERTICALS,
  // Experiment Support
  getActiveExperiment,
  getDefaultAgentConfigLoader,
  getExperimentAwareInstruction,
  isOutOfScope,
  // Telemetry
  logAgentMetric,
  logExperimentResult,
  logMatchEvent,
  logToolExecution,
  SERVICE_CATALOG,
} from './config';
