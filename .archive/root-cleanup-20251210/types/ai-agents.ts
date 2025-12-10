/**
 * @deprecated Import from '@easymo/types' or '@easymo/types/ai-agents' instead.
 * This file will be removed in the next major version.
 * 
 * Migration guide:
 * - import { AiAgent, AgentSlug } from '@easymo/types/ai-agents'
 * - Or: import type { AiAgent } from '@easymo/types'
 */

// =====================================================================
// AI AGENT ECOSYSTEM – TypeScript Types
// =====================================================================
// Generated types for AI agent ecosystem tables (WhatsApp-first)
// =====================================================================

// =====================================================================
// 1. CORE AGENT META TABLES
// =====================================================================

export interface AiAgent {
  id: string;
  slug: string;
  name: string;
  description?: string;
  defaultPersonaCode?: string;
  defaultSystemInstructionCode?: string;
  defaultLanguage?: string;
  defaultChannel?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentPersona {
  id: string;
  agentId: string;
  code?: string;
  roleName?: string;
  toneStyle?: string;
  languages?: string[];
  traits?: Record<string, any>;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentSystemInstruction {
  id: string;
  agentId: string;
  code?: string;
  title?: string;
  instructions?: string;
  guardrails?: string;
  memoryStrategy?: string;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentTool {
  id: string;
  agentId: string;
  name?: string;
  displayName?: string;
  toolType?: string;
  description?: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  config?: Record<string, any>;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentTask {
  id: string;
  agentId: string;
  code?: string;
  name?: string;
  description?: string;
  triggerDescription?: string;
  toolsUsed?: string[];
  outputDescription?: string;
  requiresHumanHandoff?: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentKnowledgeBase {
  id: string;
  agentId: string;
  code?: string;
  name?: string;
  description?: string;
  storageType?: string;
  accessMethod?: string;
  updateStrategy?: string;
  config?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================================
// 2. WHATSAPP-FIRST MESSAGING & INTENT TABLES
// =====================================================================

export interface WhatsappUser {
  id: string;
  phoneNumber: string;
  displayName?: string;
  preferredLanguage?: string;
  timezone?: string;
  userRoles?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappConversation {
  id: string;
  userId: string;
  agentId: string;
  externalThreadId?: string;
  context?: string;
  status?: string;
  lastMessageAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappMessage {
  id: string;
  conversationId: string;
  direction?: string;
  waMessageId?: string;
  messageType?: string;
  body?: string;
  payload?: Record<string, any>;
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
  structuredPayload?: Record<string, any>;
  confidence?: number;
  status?: string;
  appliedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAgentMatchEvent {
  id: string;
  agentId: string;
  conversationId?: string;
  intentId?: string;
  matchType?: string;
  demandRef?: Record<string, any>;
  supplyRef?: Record<string, any>;
  score?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// =====================================================================
// 3. RIDES DOMAIN TABLES
// =====================================================================

export interface RidesSavedLocation {
  id: string;
  userId: string;
  label?: string;
  addressText?: string;
  lat?: number;
  lng?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RidesTrip {
  id: string;
  riderUserId: string;
  driverUserId?: string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  status?: string;
  priceEstimate?: number;
  currency?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RidesDriverStatus {
  id: string;
  userId: string;
  isOnline?: boolean;
  currentLat?: number;
  currentLng?: number;
  lastSeenAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================================
// 4. INSURANCE DOMAIN TABLES
// =====================================================================

export interface InsuranceProfile {
  id: string;
  userId: string;
  vehicleIdentifier?: string;
  vehicleMetadata?: Record<string, any>;
  ownerName?: string;
  ownerIdNumber?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsuranceDocument {
  id: string;
  profileId: string;
  documentType?: string;
  fileUrl?: string;
  waMessageId?: string;
  metadata?: Record<string, any>;
  uploadedAt: Date;
}

export interface InsuranceQuoteRequest {
  id: string;
  profileId: string;
  agentId: string;
  intentId?: string;
  requestType?: string;
  status?: string;
  requestedAt?: Date;
  resolvedAt?: Date;
  quoteDetails?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================================
// 5. VIEW TYPES
// =====================================================================

export interface AiAgentsOverview {
  id: string;
  slug: string;
  name: string;
  description?: string;
  defaultLanguage?: string;
  defaultChannel?: string;
  isActive?: boolean;
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
// HELPER TYPES
// =====================================================================

export type AgentSlug = 
  | 'waiter' 
  | 'farmer' 
  | 'buy_and_sell' 
  | 'real_estate' 
  | 'jobs' 
  | 'sales_cold_caller' 
  | 'rides' 
  | 'insurance'
  | 'support';

export type IntentStatus = 'pending' | 'applied' | 'rejected';

export type ConversationStatus = 'active' | 'closed' | 'paused';

export type MessageDirection = 'inbound' | 'outbound';

export type ToolType = 'db' | 'http' | 'whatsapp' | 'sip' | 'deep_search' | 'maps';

export type StorageType = 'table' | 'view' | 'vector_store' | 'external';

export type RideStatus = 'pending' | 'matched' | 'en_route' | 'completed' | 'cancelled';

export type InsuranceRequestStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

export type InsuranceDocumentType = 'certificate' | 'carte_jaune' | 'other';
