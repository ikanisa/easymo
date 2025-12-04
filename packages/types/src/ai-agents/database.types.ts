/**
 * Database Row Types for Supabase
 * Maps to snake_case database columns
 * 
 * Consolidated from:
 * - types/ai-agents.types.ts (Database interface)
 */

// =====================================================================
// DATABASE ROW TYPES (snake_case - matches database)
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
  metadata: Record<string, unknown>;
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
  traits: Record<string, unknown>;
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
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  config: Record<string, unknown>;
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
  metadata: Record<string, unknown>;
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
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WhatsappUserRow {
  id: string;
  phone_number: string;
  display_name: string | null;
  preferred_language: string;
  timezone: string | null;
  user_roles: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WhatsappConversationRow {
  id: string;
  user_id: string;
  agent_id: string;
  external_thread_id: string | null;
  context: string | null;
  status: string;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WhatsappMessageRow {
  id: string;
  conversation_id: string;
  direction: string;
  wa_message_id: string | null;
  message_type: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  sent_at: string;
  created_at: string;
}

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
  status: string;
  applied_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AiAgentMatchEventRow {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  intent_id: string | null;
  match_type: string | null;
  demand_ref: Record<string, unknown>;
  supply_ref: Record<string, unknown>;
  score: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
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
// RIDES DOMAIN ROW TYPES
// =====================================================================

export interface RidesSavedLocationRow {
  id: string;
  user_id: string;
  label: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RidesTripRow {
  id: string;
  rider_user_id: string;
  driver_user_id: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: string;
  price_estimate: number | null;
  currency: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RidesDriverStatusRow {
  id: string;
  user_id: string;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  last_seen_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// INSURANCE DOMAIN ROW TYPES
// =====================================================================

export interface InsuranceProfileRow {
  id: string;
  user_id: string;
  vehicle_identifier: string | null;
  vehicle_metadata: Record<string, unknown>;
  owner_name: string | null;
  owner_id_number: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InsuranceDocumentRow {
  id: string;
  profile_id: string;
  document_type: string | null;
  file_url: string | null;
  wa_message_id: string | null;
  metadata: Record<string, unknown>;
  uploaded_at: string;
}

export interface InsuranceQuoteRequestRow {
  id: string;
  profile_id: string;
  agent_id: string;
  intent_id: string | null;
  request_type: string | null;
  status: string;
  requested_at: string;
  resolved_at: string | null;
  quote_details: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// SUPABASE DATABASE TYPE DEFINITION
// =====================================================================

/**
 * Supabase Database Type Definition
 * Used for type-safe database operations
 */
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
      whatsapp_users: {
        Row: WhatsappUserRow;
        Insert: Omit<WhatsappUserRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<WhatsappUserRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      whatsapp_conversations: {
        Row: WhatsappConversationRow;
        Insert: Omit<WhatsappConversationRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<WhatsappConversationRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      whatsapp_messages: {
        Row: WhatsappMessageRow;
        Insert: Omit<WhatsappMessageRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<WhatsappMessageRow, 'id' | 'created_at'>>;
      };
      ai_agent_intents: {
        Row: AiAgentIntentRow;
        Insert: Omit<AiAgentIntentRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AiAgentIntentRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      ai_agent_match_events: {
        Row: AiAgentMatchEventRow;
        Insert: Omit<AiAgentMatchEventRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<AiAgentMatchEventRow, 'id' | 'created_at'>>;
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
// UTILITY FUNCTIONS (Type Converters)
// =====================================================================

/**
 * Database-to-TypeScript field mapping helpers
 */
export const dbToTs = {
  /**
   * Convert snake_case to camelCase
   */
  toCamelCase: (str: string): string => {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  },
  
  /**
   * Convert camelCase to snake_case
   */
  toSnakeCase: (str: string): string => {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  },
};
