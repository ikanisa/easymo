/**
 * @easymo/agents - AI Agent Implementations
 * 
 * Official agents for EasyMO WhatsApp-first platform.
 * 
 * OFFICIAL AGENTS (9 production agents):
 * 1. farmer - Farmer AI Agent
 * 2. insurance - Insurance AI Agent
 * 3. sales_cold_caller - Sales/Marketing Cold Caller AI Agent
 * 4. rides - Rides AI Agent
 * 5. jobs - Jobs AI Agent
 * 6. waiter - Waiter AI Agent
 * 7. real_estate - Real Estate AI Agent
 * 8. buy_and_sell - Buy & Sell AI Agent (unified: marketplace + business broker + legal intake)
 * 9. support - Support AI Agent (includes concierge routing)
 * 
 * DEPRECATED (merged into buy_and_sell):
 * - BusinessBrokerAgent - Use BuyAndSellAgent instead
 * - MarketplaceAgent - Use BuyAndSellAgent instead
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

/**
 * @deprecated Use BuyAndSellAgent instead. BusinessBrokerAgent has been merged into BuyAndSellAgent.
 */
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
