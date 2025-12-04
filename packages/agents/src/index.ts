/**
 * @easymo/agents - AI Agent Implementations
 * 
 * Official agents for EasyMO WhatsApp-first platform.
 */

// Core functionality
export type { AgentDefinition } from './runner';
export { runAgent } from './runner';

// Base Agent
export { BaseAgent } from './agents/base/agent.base';

// Domain Agents
export { BuyAndSellAgent, runBuyAndSellAgent } from './agents/commerce/buy-and-sell.agent';
export { FarmerAgent } from './agents/farmer/farmer.agent';
export { JobsAgent } from './agents/jobs/jobs.agent';
export { RealEstateAgent } from './agents/property/real-estate.agent';
export { SalesAgent } from './agents/sales/sales.agent';
export { WaiterAgent } from './agents/waiter/waiter.agent';

// Legacy exports - deprecated, use BuyAndSellAgent instead
export { BusinessBrokerAgent, runBusinessBrokerAgent } from './agents/general/business-broker.agent';

// Tools
export {
  checkAvailabilityTool,
  createBookingTool,
  menuLookupTool,
  scriptPlannerTool,
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
