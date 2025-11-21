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

// =====================================================================
// WhatsApp-First Messaging & Intent Database Row Types
// =====================================================================

export interface WhatsappUserRow {
  id: string;
  phone_number: string;
  display_name: string | null;
  preferred_language: string;
  timezone: string | null;
  user_roles: string[];
  metadata: Record<string, any>;
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
  metadata: Record<string, any>;
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
  payload: Record<string, any>;
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
  structured_payload: Record<string, any>;
  confidence: number | null;
  status: string;
  applied_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AiAgentMatchEventRow {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  intent_id: string | null;
  match_type: string | null;
  demand_ref: Record<string, any>;
  supply_ref: Record<string, any>;
  score: number | null;
  metadata: Record<string, any>;
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

// =====================================================================
// WhatsApp-First Application Types (camelCase - for app usage)
// =====================================================================

export interface WhatsappUser {
  id: string;
  phoneNumber: string;
  displayName?: string;
  preferredLanguage: string;
  timezone?: string;
  userRoles: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappConversation {
  id: string;
  userId: string;
  agentId: string;
  externalThreadId?: string;
  context?: string;
  status: ConversationStatus;
  lastMessageAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  waMessageId?: string;
  messageType?: MessageType;
  body?: string;
  payload: Record<string, any>;
  sentAt: Date;
  createdAt: Date;
}

export interface AiAgentIntent {
  id: string;
  conversationId: string;
  agentId: string;
  messageId?: string;
  intentType?: string;
  intentSubtype?: string;
  rawText?: string;
  summary?: string;
  structuredPayload: Record<string, any>;
  confidence?: number;
  status: IntentStatus;
  appliedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentMatchEvent {
  id: string;
  agentId: string;
  conversationId?: string;
  intentId?: string;
  matchType?: MatchType;
  demandRef: Record<string, any>;
  supplyRef: Record<string, any>;
  score?: number;
  metadata: Record<string, any>;
  createdAt: Date;
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

export type ConversationStatus =
  | 'active'
  | 'closed'
  | 'paused';

export type MessageDirection =
  | 'inbound'
  | 'outbound';

export type MessageType =
  | 'text'
  | 'button'
  | 'list'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'template';

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
  | 'lead';

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

export interface ConversationWithRelations extends WhatsappConversation {
  user?: WhatsappUser;
  agent?: AiAgent;
  messages?: WhatsappMessage[];
  intents?: AiAgentIntent[];
}

export interface IntentWithRelations extends AiAgentIntent {
  conversation?: WhatsappConversation;
  agent?: AiAgent;
  message?: WhatsappMessage;
  matches?: AiAgentMatchEvent[];
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

export type CreateWhatsappUserInput = Omit<WhatsappUser, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateWhatsappUserInput = Partial<Omit<WhatsappUser, 'id' | 'phoneNumber' | 'createdAt' | 'updatedAt'>>;

export type CreateWhatsappConversationInput = Omit<WhatsappConversation, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateWhatsappConversationInput = Partial<Omit<WhatsappConversation, 'id' | 'userId' | 'agentId' | 'createdAt' | 'updatedAt'>>;

export type CreateWhatsappMessageInput = Omit<WhatsappMessage, 'id' | 'createdAt'>;
export type UpdateWhatsappMessageInput = Partial<Omit<WhatsappMessage, 'id' | 'conversationId' | 'createdAt'>>;

export type CreateAiAgentIntentInput = Omit<AiAgentIntent, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAiAgentIntentInput = Partial<Omit<AiAgentIntent, 'id' | 'conversationId' | 'agentId' | 'createdAt' | 'updatedAt'>>;

export type CreateAiAgentMatchEventInput = Omit<AiAgentMatchEvent, 'id' | 'createdAt'>;

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

// =====================================================================
// WhatsApp Type Converters
// =====================================================================

export function fromWhatsappUserRow(row: WhatsappUserRow): WhatsappUser {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    displayName: row.display_name ?? undefined,
    preferredLanguage: row.preferred_language,
    timezone: row.timezone ?? undefined,
    userRoles: row.user_roles,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function fromWhatsappConversationRow(row: WhatsappConversationRow): WhatsappConversation {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    externalThreadId: row.external_thread_id ?? undefined,
    context: row.context ?? undefined,
    status: row.status as ConversationStatus,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function fromWhatsappMessageRow(row: WhatsappMessageRow): WhatsappMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction as MessageDirection,
    waMessageId: row.wa_message_id ?? undefined,
    messageType: row.message_type as MessageType | undefined,
    body: row.body ?? undefined,
    payload: row.payload,
    sentAt: new Date(row.sent_at),
    createdAt: new Date(row.created_at),
  };
}

export function fromAiAgentIntentRow(row: AiAgentIntentRow): AiAgentIntent {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    agentId: row.agent_id,
    messageId: row.message_id ?? undefined,
    intentType: row.intent_type ?? undefined,
    intentSubtype: row.intent_subtype ?? undefined,
    rawText: row.raw_text ?? undefined,
    summary: row.summary ?? undefined,
    structuredPayload: row.structured_payload,
    confidence: row.confidence ?? undefined,
    status: row.status as IntentStatus,
    appliedAt: row.applied_at ? new Date(row.applied_at) : undefined,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function fromAiAgentMatchEventRow(row: AiAgentMatchEventRow): AiAgentMatchEvent {
  return {
    id: row.id,
    agentId: row.agent_id,
    conversationId: row.conversation_id ?? undefined,
    intentId: row.intent_id ?? undefined,
    matchType: row.match_type as MatchType | undefined,
    demandRef: row.demand_ref,
    supplyRef: row.supply_ref,
    score: row.score ?? undefined,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
  };
}

export function toWhatsappUserInsert(input: CreateWhatsappUserInput): Database['public']['Tables']['whatsapp_users']['Insert'] {
  return {
    phone_number: input.phoneNumber,
    display_name: input.displayName ?? null,
    preferred_language: input.preferredLanguage,
    timezone: input.timezone ?? null,
    user_roles: input.userRoles,
    metadata: input.metadata,
  };
}

export function toWhatsappConversationInsert(input: CreateWhatsappConversationInput): Database['public']['Tables']['whatsapp_conversations']['Insert'] {
  return {
    user_id: input.userId,
    agent_id: input.agentId,
    external_thread_id: input.externalThreadId ?? null,
    context: input.context ?? null,
    status: input.status,
    last_message_at: input.lastMessageAt?.toISOString() ?? null,
    metadata: input.metadata,
  };
}

export function toWhatsappMessageInsert(input: CreateWhatsappMessageInput): Database['public']['Tables']['whatsapp_messages']['Insert'] {
  return {
    conversation_id: input.conversationId,
    direction: input.direction,
    wa_message_id: input.waMessageId ?? null,
    message_type: input.messageType ?? null,
    body: input.body ?? null,
    payload: input.payload,
    sent_at: input.sentAt.toISOString(),
  };
}

export function toAiAgentIntentInsert(input: CreateAiAgentIntentInput): Database['public']['Tables']['ai_agent_intents']['Insert'] {
  return {
    conversation_id: input.conversationId,
    agent_id: input.agentId,
    message_id: input.messageId ?? null,
    intent_type: input.intentType ?? null,
    intent_subtype: input.intentSubtype ?? null,
    raw_text: input.rawText ?? null,
    summary: input.summary ?? null,
    structured_payload: input.structuredPayload,
    confidence: input.confidence ?? null,
    status: input.status,
    applied_at: input.appliedAt?.toISOString() ?? null,
    metadata: input.metadata,
  };
}
