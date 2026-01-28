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
  clearAgentCache,
  getAgentBySlugOrId,
  getAgentConfigLoader,
} from './loader';

// Tools
export {
  buildOpenAITools,
  buildRuntimeTools,
  buildToolExecutorMap,
  executeTool,
  getToolHandler,
  registerToolHandler,
  type ToolExecutorOptions,
} from './tools';

// Telemetry
export {
  createConversationMetrics,
  createToolExecutionLogger,
  logAgentMetric,
  logMatchEvent,
  logToolExecution,
  updateMatchEventStatus,
} from './telemetry';

// Experiments
export {
  getActiveExperiments,
  getExperimentalModelConfig,
  getExperimentalSystemInstruction,
  getExperimentAssignment,
  recordExperimentResult,
} from './experiments';
