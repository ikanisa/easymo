/**
 * Agent Config Module - Config-Driven Agent Management
 * 
 * This module provides complete config-driven agent management from Supabase:
 * 
 * - Types: Strongly-typed interfaces matching ai_agent_* tables
 * - Loader: Load agent configs with caching
 * - Tools: Build runtime tools from DB definitions
 * - Telemetry: Log metrics, tool executions, matches
 * - Experiments: A/B testing for agent instructions
 * 
 * @example
 * ```ts
 * import {
 *   AgentConfigLoader,
 *   buildRuntimeTools,
 *   logAgentMetric,
 *   getActiveExperiment,
 * } from '@easymo/agents/config';
 * 
 * // Load agent config
 * const loader = new AgentConfigLoader(supabase);
 * const config = await loader.getAgentBySlugOrId('waiter');
 * 
 * // Build runtime tools
 * const tools = buildRuntimeTools(config.tools, supabase);
 * 
 * // Log metrics
 * await logAgentMetric(supabase, {
 *   agentId: config.agent.id,
 *   channel: 'whatsapp',
 *   success: true,
 *   durationMs: 1500,
 * });
 * ```
 */

// Types
export type {
  // Database row types
  AiAgentRow,
  AiAgentPersonaRow,
  AiAgentSystemInstructionRow,
  AiAgentToolRow,
  AiAgentTaskRow,
  AiAgentKnowledgeBaseRow,
  AiAgentIntentRow,
  AiAgentMatchEventRow,
  AiAgentMetricRow,
  AiAgentToolExecutionRow,
  AiAgentInstructionExperimentRow,
  AiAgentExperimentResultRow,
  // Application types
  AiAgent,
  AiAgentPersona,
  AiAgentSystemInstruction,
  AiAgentTool,
  AiAgentTask,
  AiAgentKnowledgeBase,
  AiAgentIntent,
  // Config types
  ResolvedAgentConfig,
  // Input types
  AgentMetricInput,
  ToolExecutionInput,
  MatchEventInput,
  ExperimentResultInput,
  // Runtime types
  RuntimeTool,
  RuntimeToolContext,
  // Enums
  ToolType,
  StorageType,
  Channel,
  IntentStatus,
  MatchType,
  ExperimentStatus,
  AgentSlug,
} from './agent-config.types';

// Config Loader
export {
  AgentConfigLoader,
  createAgentConfigLoader,
  getDefaultAgentConfigLoader,
} from './agent-config-loader';

// Tool Registry Factory
export {
  buildRuntimeTools,
  TOOL_IMPLEMENTATIONS,
  sanitizeSearchQuery,
} from './tool-registry-factory';

// Telemetry
export {
  logAgentMetric,
  logToolExecution,
  logMatchEvent,
  logExperimentResult,
  logToolExecutionsBatch,
  logMatchEventsBatch,
  logCacheMetric,
  getToolExecutionStats,
  getMatchEventStats,
} from './telemetry';

// Experiment Support
export type {
  ActiveExperiment,
  ExperimentVariant,
} from './experiment-support';
export {
  getActiveExperiment,
  listExperiments,
  assignVariant,
  getInstructionForVariant,
  getExperimentAwareInstruction,
  logExperimentAssignment,
  logExperimentOutcome,
  createExperiment,
  startExperiment,
  pauseExperiment,
  completeExperiment,
  getExperimentResults,
} from './experiment-support';

// Service Catalog (existing)
export {
  EASYMO_VERTICALS,
  SERVICE_CATALOG,
  isValidVertical,
  getServiceDefinition,
  getAvailableServices,
  detectVerticalFromQuery,
  OUT_OF_SCOPE_PATTERNS,
  isOutOfScope,
  getOutOfScopeMessage,
} from './service-catalog';
export type { EasyMOVertical, ServiceDefinition } from './service-catalog';
