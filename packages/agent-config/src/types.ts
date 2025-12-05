/**
 * AI Agent Types - Mirrors Supabase ai_agent_* tables
 * 
 * These types are the canonical in-code representation of agent configuration.
 * All field names match the actual Supabase column names.
 */

// ============================================================================
// CORE AGENT TYPES
// ============================================================================

/**
 * AI Agent - Core agent definition (ai_agents table)
 */
export interface AiAgent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  default_persona_code: string | null;
  default_system_instruction_code: string | null;
  default_language: string;
  default_channel: 'whatsapp' | 'voice' | 'web' | 'all';
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Agent Config - Model and runtime parameters (ai_agent_configs table)
 */
export interface AiAgentConfig {
  agent_type: string;
  name: string;
  description: string | null;
  system_prompt: string;
  keywords: string[];
  tools: string[];
  enabled: boolean;
  priority: number;
  config: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    response_format?: 'text' | 'json' | 'structured';
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Agent Persona - Character and tone (ai_agent_personas table)
 */
export interface AiAgentPersona {
  id: string;
  agent_id: string;
  code: string;
  role_name: string;
  tone_style: string;
  languages: string[];
  traits: {
    personality?: string[];
    expertise?: string[];
    communication_style?: string;
    [key: string]: unknown;
  };
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * System Instructions - Detailed prompts and guardrails (ai_agent_system_instructions table)
 */
export interface AiAgentSystemInstruction {
  id: string;
  agent_id: string;
  code: string;
  title: string;
  instructions: string;
  guardrails: string | null;
  memory_strategy: 'none' | 'short' | 'long' | 'semantic';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Agent Intent - Routing and classification (ai_agent_intents table)
 */
export interface AiAgentIntent {
  id: string;
  agent_id: string;
  code: string;
  name: string;
  description: string | null;
  examples: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Agent Task - Workflows and capabilities (ai_agent_tasks table)
 */
export interface AiAgentTask {
  id: string;
  agent_id: string;
  code: string;
  name: string;
  description: string | null;
  trigger_description: string | null;
  tools_used: string[];
  output_description: string | null;
  requires_human_handoff: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Agent Tool - Function/API definitions (ai_agent_tools table)
 */
export interface AiAgentTool {
  id: string;
  agent_id: string;
  name: string;
  display_name: string;
  tool_type: 'db' | 'http' | 'external' | 'internal' | 'supabase_rpc';
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
      [key: string]: unknown;
    }>;
    required?: string[];
    [key: string]: unknown;
  };
  output_schema: Record<string, unknown> | null;
  config: {
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    table?: string;
    operation?: string;
    api_key_env?: string;
    handler?: string;
    [key: string]: unknown;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Knowledge Base - RAG sources (ai_agent_knowledge_bases table)
 */
export interface AiAgentKnowledgeBase {
  id: string;
  agent_id: string;
  code: string;
  name: string;
  description: string | null;
  source_type: 'supabase' | 'pinecone' | 'file' | 'url' | 'custom';
  config: {
    table?: string;
    index_name?: string;
    namespace?: string;
    file_path?: string;
    url?: string;
    [key: string]: unknown;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TELEMETRY TYPES
// ============================================================================

/**
 * Agent Metrics - High-level interaction metrics (ai_agent_metrics table)
 */
export interface AiAgentMetric {
  id: string;
  agent_id: string;
  channel: 'whatsapp' | 'voice' | 'web';
  session_id: string | null;
  duration_ms: number;
  total_tokens: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  model: string | null;
  provider: 'openai' | 'anthropic' | 'google' | null;
  success: boolean;
  error_message: string | null;
  tools_executed: string[];
  correlation_id: string | null;
  user_id: string | null;
  created_at: string;
}

/**
 * Tool Execution - Individual tool invocation logs (ai_agent_tool_executions table)
 */
export interface AiAgentToolExecution {
  id: string;
  agent_id: string;
  tool_id: string;
  tool_name: string;
  inputs: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  execution_time_ms: number;
  success: boolean;
  user_id: string | null;
  conversation_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Match Event - Agent-generated matches (ai_agent_match_events table)
 */
export interface AiAgentMatchEvent {
  id: string;
  agent_id: string;
  match_type: 'job_seeker' | 'property_tenant' | 'buyer_farmer' | 'sales_lead';
  seeker_user_id: string | null;
  seeker_phone: string | null;
  owner_user_id: string | null;
  owner_phone: string | null;
  listing_id: string | null;
  match_score: number | null;
  status: 'suggested' | 'contacted' | 'accepted' | 'rejected';
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// RESOLVED CONFIG TYPE
// ============================================================================

/**
 * Fully resolved agent configuration - all related data combined
 */
export interface ResolvedAgentConfig {
  agent: AiAgent;
  config: AiAgentConfig | null;
  persona: AiAgentPersona | null;
  systemInstructions: AiAgentSystemInstruction[];
  intents: AiAgentIntent[];
  tasks: AiAgentTask[];
  tools: AiAgentTool[];
  knowledgeBases: AiAgentKnowledgeBase[];
}

// ============================================================================
// INPUT TYPES FOR TELEMETRY
// ============================================================================

export interface MetricInput {
  agent_id: string;
  channel: 'whatsapp' | 'voice' | 'web';
  session_id?: string;
  duration_ms: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost_usd?: number;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  success: boolean;
  error_message?: string;
  tools_executed?: string[];
  correlation_id?: string;
  user_id?: string;
}

export interface ToolExecutionInput {
  agent_id: string;
  tool_id: string;
  tool_name: string;
  inputs: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  execution_time_ms: number;
  success: boolean;
  user_id?: string;
  conversation_id?: string;
  metadata?: Record<string, unknown>;
}

export interface MatchEventInput {
  agent_id: string;
  match_type: 'job_seeker' | 'property_tenant' | 'buyer_farmer' | 'sales_lead';
  seeker_user_id?: string;
  seeker_phone?: string;
  owner_user_id?: string;
  owner_phone?: string;
  listing_id?: string;
  match_score?: number;
  status?: 'suggested' | 'contacted' | 'accepted' | 'rejected';
  metadata?: Record<string, unknown>;
}

// ============================================================================
// RUNTIME TOOL TYPE (for OpenAI/Responses/Agents SDK)
// ============================================================================

export interface RuntimeTool {
  name: string;
  description: string;
  parameters: AiAgentTool['input_schema'];
  // Implementation handler reference
  handler?: string;
  config?: AiAgentTool['config'];
}
