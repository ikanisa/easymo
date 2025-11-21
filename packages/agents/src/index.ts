/**
 * @easymo/agents - OpenAI Agents SDK integration
 * 
 * Main entry point for the agents package.
 */

// Core functionality
export { runAgent } from './runner';
export type { AgentDefinition } from './runner';

// Agents
export {
  // NearbyDriversAgent,
  // PharmacyAgent,
  RealEstateAgent,
  // QuincaillerieAgent,
  runBusinessBrokerAgent,
  SalesAgent,
  // ScheduleTripAgent,
  // ShopsAgent,
  // SupportAgent,
  // TriageAgent,
  WaiterAgent,
} from './agents';

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
export {
  isAgentFeatureEnabled,
  requireAgentFeature,
} from './feature-flags';
export type { AgentFeatureFlag } from './feature-flags';
