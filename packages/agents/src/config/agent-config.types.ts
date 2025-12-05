/**
 * Agent Config Types - Mirrors Supabase ai_agent_* Tables
 * 
 * This file defines TypeScript interfaces that match the database schema
 * for fully config-driven agent management from Supabase.
 * 
 * Tables:
 * - ai_agents
 * - ai_agent_configs (legacy, mapped from ai_agents)
 * - ai_agent_personas
 * - ai_agent_system_instructions
 * - ai_agent_intents
 * - ai_agent_tasks
 * - ai_agent_tools
 * - ai_agent_tool_executions
 * - ai_agent_tool_execution_stats
 * - ai_agent_knowledge_bases
 * - ai_agent_metrics
 * - ai_agent_match_events
 * - ai_agent_experiment_results
 * - ai_agent_experiment_analytics
 * - ai_agent_instruction_experiments
 */

// =====================================================================
// DATABASE ROW TYPES (snake_case - matches Supabase database)
// =====================================================================

/**
 * ai_agents table row
 */
export interface AiAgentRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  default_persona_code: string | null;
  default_system_instruction_code: string | null;
  default_language: string;
  default_channel: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * ai_agent_personas table row
 */
export interface AiAgentPersonaRow {
  id: string;
  agent_id: string;
  code: string;
  role_name: string | null;
  tone_style: string | null;
  languages: string[];
  traits: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * ai_agent_system_instructions table row
 */
export interface AiAgentSystemInstructionRow {
  id: string;
  agent_id: string;
  code: string;
  title: string | null;
  instructions: string;
  guardrails: string | null;
  memory_strategy: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * ai_agent_tools table row
 */
export interface AiAgentToolRow {
  id: string;
  agent_id: string;
  name: string;
  display_name: string | null;
  tool_type: ToolType;
  description: string | null;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * ai_agent_tasks table row
 */
export interface AiAgentTaskRow {
  id: string;
  agent_id: string;
  code: string;
  name: string;
  description: string | null;
  trigger_description: string | null;
  tools_used: string[];
  output_description: string | null;
  requires_human_handoff: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * ai_agent_knowledge_bases table row
 */
export interface AiAgentKnowledgeBaseRow {
  id: string;
  agent_id: string;
  code: string;
  name: string;
  description: string | null;
  storage_type: StorageType;
  access_method: string;
  update_strategy: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * ai_agent_intents table row
 */
export interface AiAgentIntentRow {
  id: string;
  conversation_id: string;
  agent_id: string;
  message_id: string | null;
  intent_type: string | null;
  intent_subtype: string | null;
  raw_text: string | null;
  summary: string | null;
  structured_payload: Record<string, unknown>;
  confidence: number | null;
  status: IntentStatus;
  applied_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * ai_agent_match_events table row
 */
export interface AiAgentMatchEventRow {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  intent_id: string | null;
  match_type: MatchType | null;
  demand_ref: Record<string, unknown>;
  supply_ref: Record<string, unknown>;
  score: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * ai_agent_metrics table row
 */
export interface AiAgentMetricRow {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  channel: Channel;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_estimate: number | null;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * ai_agent_tool_executions table row
 */
export interface AiAgentToolExecutionRow {
  id: string;
  agent_id: string;
  tool_id: string;
  tool_name: string;
  conversation_id: string | null;
  user_id: string | null;
  inputs: Record<string, unknown>;
  result: unknown;
  error: string | null;
  execution_time_ms: number;
  success: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * ai_agent_instruction_experiments table row
 */
export interface AiAgentInstructionExperimentRow {
  id: string;
  agent_id: string;
  experiment_name: string;
  variant_a_instruction_id: string | null;
  variant_b_instruction_id: string | null;
  traffic_split_percent: number;
  start_date: string;
  end_date: string | null;
  status: ExperimentStatus;
  success_metric: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ai_agent_experiment_results table row
 */
export interface AiAgentExperimentResultRow {
  id: string;
  experiment_id: string;
  user_id: string | null;
  variant: 'A' | 'B';
  instruction_id: string | null;
  conversation_id: string | null;
  success: boolean | null;
  user_satisfaction_score: number | null;
  conversation_length: number | null;
  tools_executed: number;
  tools_succeeded: number;
  response_time_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// =====================================================================
// ENUMS
// =====================================================================

export type ToolType =
  | 'db'
  | 'http'
  | 'deep_search'
  | 'maps'
  | 'sip'
  | 'whatsapp'
  | 'momo'
  | 'voice'
  | 'vector_store'
  | 'location'
  | 'static'
  | 'external';

export type StorageType =
  | 'table'
  | 'view'
  | 'vector_store'
  | 'external';

export type Channel =
  | 'whatsapp'
  | 'voice'
  | 'web'
  | 'sms';

export type IntentStatus =
  | 'pending'
  | 'applied'
  | 'rejected';

export type MatchType =
  | 'job'
  | 'property'
  | 'produce'
  | 'business'
  | 'menu_item'
  | 'lead'
  | 'ride'
  | 'insurance_quote';

export type ExperimentStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed';

export type AgentSlug =
  | 'waiter'
  | 'farmer'
  | 'buy_and_sell'
  | 'real_estate'
  | 'jobs'
  | 'sales_cold_caller'
  | 'sales'
  | 'rides'
  | 'insurance'
  | 'support'
  | 'marketplace'
  | 'business_broker';

// =====================================================================
// APPLICATION TYPES (camelCase - for app usage)
// =====================================================================

/**
 * Agent configuration loaded from database
 */
export interface AiAgent {
  id: string;
  slug: string;
  name: string;
  description?: string;
  defaultPersonaCode?: string;
  defaultSystemInstructionCode?: string;
  defaultLanguage: string;
  defaultChannel: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent persona loaded from database
 */
export interface AiAgentPersona {
  id: string;
  agentId: string;
  code: string;
  roleName?: string;
  toneStyle?: string;
  languages: string[];
  traits: Record<string, unknown>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent system instructions loaded from database
 */
export interface AiAgentSystemInstruction {
  id: string;
  agentId: string;
  code: string;
  title?: string;
  instructions: string;
  guardrails?: string;
  memoryStrategy?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent tool loaded from database
 */
export interface AiAgentTool {
  id: string;
  agentId: string;
  name: string;
  displayName?: string;
  toolType: ToolType;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent task loaded from database
 */
export interface AiAgentTask {
  id: string;
  agentId: string;
  code: string;
  name: string;
  description?: string;
  triggerDescription?: string;
  toolsUsed: string[];
  outputDescription?: string;
  requiresHumanHandoff: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent knowledge base loaded from database
 */
export interface AiAgentKnowledgeBase {
  id: string;
  agentId: string;
  code: string;
  name: string;
  description?: string;
  storageType: StorageType;
  accessMethod: string;
  updateStrategy?: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent intent
 */
export interface AiAgentIntent {
  id: string;
  conversationId: string;
  agentId: string;
  messageId?: string;
  intentType?: string;
  intentSubtype?: string;
  rawText?: string;
  summary?: string;
  structuredPayload: Record<string, unknown>;
  confidence?: number;
  status: IntentStatus;
  appliedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================================
// RESOLVED CONFIG TYPE
// =====================================================================

/**
 * Complete resolved agent configuration
 * This is the main type returned by getAgentBySlugOrId()
 */
export interface ResolvedAgentConfig {
  agent: AiAgent;
  persona: AiAgentPersona | null;
  systemInstructions: AiAgentSystemInstruction[];
  intents?: AiAgentIntent[];
  tasks: AiAgentTask[];
  tools: AiAgentTool[];
  knowledgeBases: AiAgentKnowledgeBase[];
  loadedFrom: 'database' | 'cache' | 'fallback';
  timestamp: string;
}

// =====================================================================
// INPUT TYPES FOR TELEMETRY
// =====================================================================

/**
 * Input for logging agent metrics
 */
export interface AgentMetricInput {
  agentId: string;
  conversationId?: string;
  channel: Channel;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costEstimate?: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for logging tool executions
 */
export interface ToolExecutionInput {
  agentId: string;
  toolId: string;
  toolName: string;
  conversationId?: string;
  userId?: string;
  inputs: Record<string, unknown>;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Input for logging match events
 */
export interface MatchEventInput {
  agentId: string;
  conversationId?: string;
  intentId?: string;
  matchType: MatchType;
  demandRef: Record<string, unknown>;
  supplyRef: Record<string, unknown>;
  score?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Input for logging experiment results
 */
export interface ExperimentResultInput {
  experimentId: string;
  userId?: string;
  variant: 'A' | 'B';
  instructionId?: string;
  conversationId?: string;
  success?: boolean;
  userSatisfactionScore?: number;
  conversationLength?: number;
  toolsExecuted?: number;
  toolsSucceeded?: number;
  responseTimeMs?: number;
  metadata?: Record<string, unknown>;
}

// =====================================================================
// RUNTIME TOOL TYPE
// =====================================================================

/**
 * Runtime tool definition for OpenAI/Gemini
 */
export interface RuntimeTool {
  name: string;
  displayName?: string;
  description: string;
  type: ToolType;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: Record<string, unknown>, context: RuntimeToolContext) => Promise<unknown>;
}

/**
 * Context passed to runtime tool execution
 */
export interface RuntimeToolContext {
  userId: string;
  agentId: string;
  conversationId?: string;
  agentSlug: string;
  sessionId?: string;
}
