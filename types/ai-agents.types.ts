/**
 * AI Agent Ecosystem - TypeScript Type Definitions
 * Auto-generated types for Supabase AI Agent tables
 */

// =====================================================================
// Database Row Types (snake_case - matches database)
// =====================================================================

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
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AiAgentPersonaRow {
  id: string;
  agent_id: string;
  code: string;
  role_name: string | null;
  tone_style: string | null;
  languages: string[];
  traits: Record<string, any>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

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

export interface AiAgentToolRow {
  id: string;
  agent_id: string;
  name: string;
  display_name: string | null;
  tool_type: string;
  description: string | null;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AiAgentKnowledgeBaseRow {
  id: string;
  agent_id: string;
  code: string;
  name: string;
  description: string | null;
  storage_type: string;
  access_method: string;
  update_strategy: string | null;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AiAgentsOverviewRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  default_language: string;
  default_channel: string;
  is_active: boolean;
  default_persona_code: string | null;
  default_persona_role_name: string | null;
  default_system_instruction_code: string | null;
  default_system_instruction_title: string | null;
  tool_count: number;
  task_count: number;
  kb_count: number;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// Application Types (camelCase - for app usage)
// =====================================================================

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
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentPersona {
  id: string;
  agentId: string;
  code: string;
  roleName?: string;
  toneStyle?: string;
  languages: string[];
  traits: Record<string, any>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface AiAgentTool {
  id: string;
  agentId: string;
  name: string;
  displayName?: string;
  toolType: ToolType;
  description?: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  config: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentKnowledgeBase {
  id: string;
  agentId: string;
  code: string;
  name: string;
  description?: string;
  storageType: StorageType;
  accessMethod: string;
  updateStrategy?: string;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentsOverview {
  id: string;
  slug: string;
  name: string;
  description?: string;
  defaultLanguage: string;
  defaultChannel: string;
  isActive: boolean;
  defaultPersonaCode?: string;
  defaultPersonaRoleName?: string;
  defaultSystemInstructionCode?: string;
  defaultSystemInstructionTitle?: string;
  toolCount: number;
  taskCount: number;
  kbCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================================
// Enums and Constants
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
  | 'external';

export type StorageType =
  | 'table'
  | 'view'
  | 'vector_store'
  | 'external';

export type AgentSlug =
  | 'waiter'
  | 'farmer'
  | 'business_broker'
  | 'real_estate'
  | 'jobs'
  | 'sales_cold_caller';

export type Channel =
  | 'whatsapp'
  | 'voice'
  | 'web'
  | 'sms';

// =====================================================================
// Helper Types
// =====================================================================

export interface AgentWithRelations extends AiAgent {
  persona?: AiAgentPersona;
  systemInstruction?: AiAgentSystemInstruction;
  tools?: AiAgentTool[];
  tasks?: AiAgentTask[];
  knowledgeBases?: AiAgentKnowledgeBase[];
}

export type CreateAiAgentInput = Omit<AiAgent, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAiAgentInput = Partial<Omit<AiAgent, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateAiAgentPersonaInput = Omit<AiAgentPersona, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAiAgentPersonaInput = Partial<Omit<AiAgentPersona, 'id' | 'agentId' | 'createdAt' | 'updatedAt'>>;

export type CreateAiAgentToolInput = Omit<AiAgentTool, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAiAgentToolInput = Partial<Omit<AiAgentTool, 'id' | 'agentId' | 'createdAt' | 'updatedAt'>>;

export type CreateAiAgentTaskInput = Omit<AiAgentTask, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAiAgentTaskInput = Partial<Omit<AiAgentTask, 'id' | 'agentId' | 'createdAt' | 'updatedAt'>>;

export type CreateAiAgentKnowledgeBaseInput = Omit<AiAgentKnowledgeBase, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAiAgentKnowledgeBaseInput = Partial<Omit<AiAgentKnowledgeBase, 'id' | 'agentId' | 'createdAt' | 'updatedAt'>>;

// =====================================================================
// Supabase Database Extension
// =====================================================================

export interface Database {
  public: {
    Tables: {
      ai_agents: {
        Row: AiAgentRow;
        Insert: Omit<AiAgentRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AiAgentRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      ai_agent_personas: {
        Row: AiAgentPersonaRow;
        Insert: Omit<AiAgentPersonaRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AiAgentPersonaRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      ai_agent_system_instructions: {
        Row: AiAgentSystemInstructionRow;
        Insert: Omit<AiAgentSystemInstructionRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AiAgentSystemInstructionRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      ai_agent_tools: {
        Row: AiAgentToolRow;
        Insert: Omit<AiAgentToolRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AiAgentToolRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      ai_agent_tasks: {
        Row: AiAgentTaskRow;
        Insert: Omit<AiAgentTaskRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AiAgentTaskRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      ai_agent_knowledge_bases: {
        Row: AiAgentKnowledgeBaseRow;
        Insert: Omit<AiAgentKnowledgeBaseRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AiAgentKnowledgeBaseRow, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Views: {
      ai_agents_overview_v: {
        Row: AiAgentsOverviewRow;
      };
    };
  };
}

// =====================================================================
// Utility Functions (Type Converters)
// =====================================================================

/**
 * Convert database row to application type (snake_case to camelCase)
 */
export function fromAiAgentRow(row: AiAgentRow): AiAgent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    defaultPersonaCode: row.default_persona_code ?? undefined,
    defaultSystemInstructionCode: row.default_system_instruction_code ?? undefined,
    defaultLanguage: row.default_language,
    defaultChannel: row.default_channel,
    isActive: row.is_active,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function fromAiAgentPersonaRow(row: AiAgentPersonaRow): AiAgentPersona {
  return {
    id: row.id,
    agentId: row.agent_id,
    code: row.code,
    roleName: row.role_name ?? undefined,
    toneStyle: row.tone_style ?? undefined,
    languages: row.languages,
    traits: row.traits,
    isDefault: row.is_default,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function fromAiAgentToolRow(row: AiAgentToolRow): AiAgentTool {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    displayName: row.display_name ?? undefined,
    toolType: row.tool_type as ToolType,
    description: row.description ?? undefined,
    inputSchema: row.input_schema,
    outputSchema: row.output_schema,
    config: row.config,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Convert application type to database insert (camelCase to snake_case)
 */
export function toAiAgentInsert(input: CreateAiAgentInput): Database['public']['Tables']['ai_agents']['Insert'] {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    default_persona_code: input.defaultPersonaCode ?? null,
    default_system_instruction_code: input.defaultSystemInstructionCode ?? null,
    default_language: input.defaultLanguage,
    default_channel: input.defaultChannel,
    is_active: input.isActive,
    metadata: input.metadata,
  };
}
