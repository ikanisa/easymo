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
  // Input types
  AgentMetricInput,
  AgentSlug,
  // Application types
  AiAgent,
  AiAgentExperimentResultRow,
  AiAgentInstructionExperimentRow,
  AiAgentIntent,
  AiAgentIntentRow,
  AiAgentKnowledgeBase,
  AiAgentKnowledgeBaseRow,
  AiAgentMatchEventRow,
  AiAgentMetricRow,
  AiAgentPersona,
  AiAgentPersonaRow,
  // Database row types
  AiAgentRow,
  AiAgentSystemInstruction,
  AiAgentSystemInstructionRow,
  AiAgentTask,
  AiAgentTaskRow,
  AiAgentTool,
  AiAgentToolExecutionRow,
  AiAgentToolRow,
  Channel,
  ExperimentResultInput,
  ExperimentStatus,
  IntentStatus,
  MatchEventInput,
  MatchType,
  // Config types
  ResolvedAgentConfig,
  // Runtime types
  RuntimeTool,
  RuntimeToolContext,
  StorageType,
  ToolExecutionInput,
  // Enums
  ToolType,
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
  sanitizeSearchQuery,
  TOOL_IMPLEMENTATIONS,
} from './tool-registry-factory';

// Telemetry
export {
  getMatchEventStats,
  getToolExecutionStats,
  logAgentMetric,
  logCacheMetric,
  logExperimentResult,
  logMatchEvent,
  logMatchEventsBatch,
  logToolExecution,
  logToolExecutionsBatch,
} from './telemetry';

// Experiment Support
export type {
  ActiveExperiment,
  ExperimentVariant,
} from './experiment-support';
export {
  assignVariant,
  completeExperiment,
  createExperiment,
  getActiveExperiment,
  getExperimentAwareInstruction,
  getExperimentResults,
  getInstructionForVariant,
  listExperiments,
  logExperimentAssignment,
  logExperimentOutcome,
  pauseExperiment,
  startExperiment,
} from './experiment-support';

// Service Catalog (existing)
export type { EasyMOVertical, ServiceDefinition } from './service-catalog';
export {
  detectVerticalFromQuery,
  EASYMO_VERTICALS,
  getAvailableServices,
  getOutOfScopeMessage,
  getServiceDefinition,
  isOutOfScope,
  isValidVertical,
  OUT_OF_SCOPE_PATTERNS,
  SERVICE_CATALOG,
} from './service-catalog';
