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
  analyzeIntent,
  BookingAgent,
  FarmerAgent,
  GeneralBrokerAgent,
  JobsAgent,
  NearbyDriversAgent,
  PharmacyAgent,
  PropertyRentalAgent,
  QuincaillerieAgent,
  runBookingAgent,
  runGeneralBrokerAgent,
  runTriageAgent,
  SalesAgent,
  ScheduleTripAgent,
  ShopsAgent,
  SupportAgent,
  TriageAgent,
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
  AgentContext,
  AgentInput,
  AgentResult,
  AgentTrace,
  ToolDefinition,
  AgentConfig,
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
