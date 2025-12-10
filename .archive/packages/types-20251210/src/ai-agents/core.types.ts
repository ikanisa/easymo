/**
 * Core AI Agent Types
 * Single source of truth for all agent-related type definitions
 * 
 * Consolidated from:
 * - types/ai-agents.ts
 * - types/ai-agents.types.ts
 * - types/ai-agent-ecosystem.ts
 * - src/lib/types/ai-agents.ts
 * - supabase/functions/_shared/types/ai-agents.ts
 */

// =====================================================================
// CORE AGENT META TYPES
// =====================================================================

/**
 * AI Agent Definition
 * Represents an agent in the system (e.g., waiter, farmer, rides)
 */
export interface AiAgent {
  id: string;
  slug: string;
  name: string;
  description?: string;
  defaultPersonaCode?: string;
  defaultSystemInstructionCode?: string;
  defaultLanguage?: string;
  defaultChannel?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Agent Persona
 * Defines the personality and communication style of an agent
 */
export interface AiAgentPersona {
  id: string;
  agentId: string;
  code?: string;
  roleName?: string;
  toneStyle?: string;
  languages?: string[];
  traits?: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Agent System Instruction
 * Contains the core instructions and guardrails for agent behavior
 */
export interface AiAgentSystemInstruction {
  id: string;
  agentId: string;
  code?: string;
  title?: string;
  instructions?: string;
  guardrails?: string;
  memoryStrategy?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Agent Tool
 * Defines tools/capabilities available to an agent
 */
export interface AiAgentTool {
  id: string;
  agentId: string;
  name?: string;
  displayName?: string;
  toolType?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  config?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Agent Task
 * Defines specific tasks an agent can perform
 */
export interface AiAgentTask {
  id: string;
  agentId: string;
  code?: string;
  name?: string;
  description?: string;
  triggerDescription?: string;
  toolsUsed?: string[];
  outputDescription?: string;
  requiresHumanHandoff: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Agent Knowledge Base
 * Defines knowledge sources available to an agent
 */
export interface AiAgentKnowledgeBase {
  id: string;
  agentId: string;
  code?: string;
  name?: string;
  description?: string;
  storageType?: string;
  accessMethod?: string;
  updateStrategy?: string;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Agent Intent
 * Represents a classified user intent during conversation
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
  structuredPayload?: Record<string, unknown>;
  confidence?: number;
  status: IntentStatus;
  appliedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Agent Match Event
 * Records matching events between demand and supply
 */
export interface AiAgentMatchEvent {
  id: string;
  agentId: string;
  conversationId?: string;
  intentId?: string;
  matchType?: string;
  demandRef?: Record<string, unknown>;
  supplyRef?: Record<string, unknown>;
  score?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * AI Agents Overview View
 * Aggregated view of agent with counts
 */
export interface AiAgentsOverview {
  id: string;
  slug: string;
  name: string;
  description?: string;
  defaultLanguage?: string;
  defaultChannel?: string;
  isActive: boolean;
  defaultPersonaCode?: string;
  defaultPersonaRoleName?: string;
  defaultSystemInstructionCode?: string;
  defaultSystemInstructionTitle?: string;
  toolCount: number;
  taskCount: number;
  kbCount: number;
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// RELATION TYPES
// =====================================================================

/**
 * Agent with all relations loaded
 */
export interface AgentWithRelations extends AiAgent {
  persona?: AiAgentPersona;
  systemInstruction?: AiAgentSystemInstruction;
  tools?: AiAgentTool[];
  tasks?: AiAgentTask[];
  knowledgeBases?: AiAgentKnowledgeBase[];
}

// =====================================================================
// HELPER / ENUM TYPES
// =====================================================================

/**
 * Intent processing status
 */
export type IntentStatus = 'pending' | 'applied' | 'rejected';

/**
 * Conversation status
 */
export type ConversationStatus = 'active' | 'closed' | 'paused';

/**
 * Message direction
 */
export type MessageDirection = 'inbound' | 'outbound';

/**
 * Tool types available in the system
 */
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

/**
 * Knowledge base storage types
 */
export type StorageType =
  | 'table'
  | 'view'
  | 'vector_store'
  | 'external';

/**
 * Communication channels
 */
export type Channel =
  | 'whatsapp'
  | 'voice'
  | 'web'
  | 'sms';

/**
 * Message types for WhatsApp
 */
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

/**
 * Match types for agent matching events
 */
export type MatchType =
  | 'job'
  | 'property'
  | 'produce'
  | 'business'
  | 'menu_item'
  | 'lead'
  | 'ride'
  | 'insurance_quote';

// =====================================================================
// INPUT TYPES FOR CRUD OPERATIONS
// =====================================================================

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

export type CreateAiAgentIntentInput = Omit<AiAgentIntent, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAiAgentIntentInput = Partial<Omit<AiAgentIntent, 'id' | 'conversationId' | 'agentId' | 'createdAt' | 'updatedAt'>>;

export type CreateAiAgentMatchEventInput = Omit<AiAgentMatchEvent, 'id' | 'createdAt'>;
