/**
 * TypeScript types for AI Agent Ecosystem (WhatsApp-first)
 * Generated from Supabase schema
 * Maps snake_case DB columns to camelCase TS properties
 */

// =====================================================================
// CORE AGENT META TYPES
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
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AiAgentPersona {
  id: string;
  agentId: string;
  code?: string;
  roleName?: string;
  toneStyle?: string;
  languages?: string[];
  traits?: Record<string, any>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  requiresHumanHandoff: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// WHATSAPP MESSAGING & INTENT TYPES
// =====================================================================

export interface WhatsappUser {
  id: string;
  phoneNumber: string;
  displayName?: string;
  preferredLanguage?: string;
  timezone?: string;
  userRoles?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappConversation {
  id: string;
  userId: string;
  agentId: string;
  externalThreadId?: string;
  context?: string;
  status: 'active' | 'closed' | 'paused';
  lastMessageAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  waMessageId?: string;
  messageType?: string;
  body?: string;
  payload?: Record<string, any>;
  sentAt: string;
  createdAt: string;
}

export interface AiAgentIntent {
  id: string;
  conversationId: string;
  agentId: string;
  messageId?: string;
  intentType: string;
  intentSubtype?: string;
  rawText?: string;
  summary?: string;
  structuredPayload?: Record<string, any>;
  confidence?: number;
  status: 'pending' | 'applied' | 'rejected';
  appliedAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AiAgentMatchEvent {
  id: string;
  agentId: string;
  conversationId?: string;
  intentId?: string;
  matchType: string;
  demandRef?: Record<string, any>;
  supplyRef?: Record<string, any>;
  score?: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

// =====================================================================
// RIDES DOMAIN TYPES
// =====================================================================

export interface RidesSavedLocation {
  id: string;
  userId: string;
  label?: string;
  addressText?: string;
  lat?: number;
  lng?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
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
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  status: 'pending' | 'matched' | 'en_route' | 'completed' | 'cancelled';
  priceEstimate?: number;
  currency: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface RidesDriverStatus {
  id: string;
  userId: string;
  isOnline: boolean;
  currentLat?: number;
  currentLng?: number;
  lastSeenAt: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// INSURANCE DOMAIN TYPES
// =====================================================================

export interface InsuranceProfile {
  id: string;
  userId: string;
  vehicleIdentifier?: string;
  vehicleMetadata?: Record<string, any>;
  ownerName?: string;
  ownerIdNumber?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceDocument {
  id: string;
  profileId: string;
  documentType?: string;
  fileUrl?: string;
  waMessageId?: string;
  metadata?: Record<string, any>;
  uploadedAt: string;
}

export interface InsuranceQuoteRequest {
  id: string;
  profileId: string;
  agentId: string;
  intentId?: string;
  requestType?: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
  quoteDetails?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// VIEW TYPES
// =====================================================================

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
// RPC FUNCTION TYPES
// =====================================================================

export interface RidesNearbyDriver {
  userId: string;
  distanceKm: number;
  currentLat: number;
  currentLng: number;
  lastSeenAt: string;
  metadata?: Record<string, any>;
}

export interface RidesNearbyPassenger {
  tripId: string;
  riderUserId: string;
  distanceKm: number;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress?: string;
  scheduledAt?: string;
  metadata?: Record<string, any>;
}

export interface InsuranceUserRequest {
  requestId: string;
  profileId: string;
  vehicleIdentifier?: string;
  requestType?: string;
  status: string;
  requestedAt: string;
  quoteDetails?: Record<string, any>;
}

export interface ApplyIntentResult {
  success: boolean;
  error?: string;
  action?: string;
  tripId?: string;
  profileId?: string;
  documentId?: string;
  requestId?: string;
  [key: string]: any;
}

// =====================================================================
// HELPER TYPES
// =====================================================================

export type AgentSlug = 
  | 'waiter'
  | 'farmer'
  | 'broker'
  | 'business_broker'
  | 'real_estate'
  | 'jobs'
  | 'sales_cold_caller'
  | 'rides'
  | 'insurance';

export type IntentStatus = 'pending' | 'applied' | 'rejected';

export type ConversationStatus = 'active' | 'closed' | 'paused';

export type TripStatus = 'pending' | 'matched' | 'en_route' | 'completed' | 'cancelled';

export type QuoteStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

// Database-to-TypeScript field mapping helpers
export const dbToTs = {
  // Convert snake_case to camelCase
  toCamelCase: (str: string): string => {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  },
  
  // Convert camelCase to snake_case
  toSnakeCase: (str: string): string => {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  },
};
