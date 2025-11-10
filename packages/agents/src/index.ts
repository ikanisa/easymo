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
  BookingAgent,
  runBookingAgent,
  TokenRedemptionAgent,
  runTokenRedemptionAgent,
  TriageAgent,
  runTriageAgent,
  analyzeIntent,
} from './agents';

// Tools
export {
  webSearchTool,
  menuLookupTool,
  checkAvailabilityTool,
  createBookingTool,
  checkBalanceTool,
  scriptPlannerTool,
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
  logStructuredEvent,
  logAgentStart,
  logAgentComplete,
  logAgentError,
  logToolInvocation,
  logAgentHandoff,
  recordMetric,
  storeAgentTrace,
} from './observability';

// Feature flags
export {
  isAgentFeatureEnabled,
  requireAgentFeature,
} from './feature-flags';
export type { AgentFeatureFlag } from './feature-flags';
