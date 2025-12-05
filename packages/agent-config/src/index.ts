/**
 * @easymo/agent-config
 * 
 * Config-driven AI agent loader from Supabase.
 * Makes all agents DB-driven - no hardcoded configs in code.
 * 
 * Usage:
 * ```ts
 * import { getAgentBySlugOrId, buildOpenAITools, createConversationMetrics } from '@easymo/agent-config';
 * 
 * const agent = await getAgentBySlugOrId(supabase, 'jobs');
 * const tools = buildOpenAITools(agent.tools);
 * const metrics = createConversationMetrics(supabase, { agentId: agent.agent.id, channel: 'whatsapp' });
 * ```
 */

// Types
export * from './types';

// Loader
export {
  AgentConfigLoader,
  getAgentConfigLoader,
  getAgentBySlugOrId,
  clearAgentCache,
} from './loader';

// Tools
export {
  registerToolHandler,
  getToolHandler,
  executeTool,
  buildRuntimeTools,
  buildOpenAITools,
  buildToolExecutorMap,
  type ToolExecutorOptions,
} from './tools';

// Telemetry
export {
  logAgentMetric,
  logToolExecution,
  logMatchEvent,
  updateMatchEventStatus,
  createToolExecutionLogger,
  createConversationMetrics,
} from './telemetry';

// Experiments
export {
  getActiveExperiments,
  getExperimentAssignment,
  recordExperimentResult,
  getExperimentalSystemInstruction,
  getExperimentalModelConfig,
} from './experiments';
