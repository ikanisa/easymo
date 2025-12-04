/**
 * WhatsApp Ecosystem Types
 * Types for WhatsApp-first messaging and related domain entities
 * 
 * Consolidated from:
 * - types/ai-agent-ecosystem.ts
 * - types/ai-agents.types.ts
 */

import type { ConversationStatus, MessageDirection } from './core.types.js';

// =====================================================================
// WHATSAPP USER & MESSAGING TYPES
// =====================================================================

/**
 * WhatsApp User
 * Represents a user in the WhatsApp ecosystem
 */
export interface WhatsappUser {
  id: string;
  phoneNumber: string;
  displayName?: string;
  preferredLanguage?: string;
  timezone?: string;
  userRoles?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * WhatsApp Conversation
 * Represents a conversation thread between a user and an agent
 */
export interface WhatsappConversation {
  id: string;
  userId: string;
  agentId: string;
  externalThreadId?: string;
  context?: string;
  status: ConversationStatus;
  lastMessageAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * WhatsApp Message
 * Individual message in a conversation
 */
export interface WhatsappMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  waMessageId?: string;
  messageType?: string;
  body?: string;
  payload?: Record<string, unknown>;
  sentAt: string;
  createdAt: string;
}

// =====================================================================
// RIDES DOMAIN TYPES
// =====================================================================

/**
 * Saved location for rides
 */
export interface RidesSavedLocation {
  id: string;
  userId: string;
  label?: string;
  addressText?: string;
  lat?: number;
  lng?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Trip status enum
 */
export type TripStatus = 'pending' | 'matched' | 'en_route' | 'completed' | 'cancelled';

/**
 * Ride trip record
 */
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
  status: TripStatus;
  priceEstimate?: number;
  currency: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Driver online status
 */
export interface RidesDriverStatus {
  id: string;
  userId: string;
  isOnline: boolean;
  currentLat?: number;
  currentLng?: number;
  lastSeenAt: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// INSURANCE DOMAIN TYPES
// =====================================================================

/**
 * Insurance profile for a user
 */
export interface InsuranceProfile {
  id: string;
  userId: string;
  vehicleIdentifier?: string;
  vehicleMetadata?: Record<string, unknown>;
  ownerName?: string;
  ownerIdNumber?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Insurance document type enum
 */
export type InsuranceDocumentType = 'certificate' | 'carte_jaune' | 'other';

/**
 * Insurance document record
 */
export interface InsuranceDocument {
  id: string;
  profileId: string;
  documentType?: string;
  fileUrl?: string;
  waMessageId?: string;
  metadata?: Record<string, unknown>;
  uploadedAt: string;
}

/**
 * Insurance request type enum
 */
export type InsuranceRequestType = 'new' | 'renewal';

/**
 * Insurance quote status enum
 */
export type InsuranceQuoteStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

/**
 * Insurance quote request record
 */
export interface InsuranceQuoteRequest {
  id: string;
  profileId: string;
  agentId: string;
  intentId?: string;
  requestType?: InsuranceRequestType;
  status: InsuranceQuoteStatus;
  requestedAt: string;
  resolvedAt?: string;
  quoteDetails?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// CONVERSATION RELATION TYPES
// =====================================================================

/**
 * Conversation with all relations loaded
 */
export interface ConversationWithRelations extends WhatsappConversation {
  user?: WhatsappUser;
  messages?: WhatsappMessage[];
}

// =====================================================================
// INPUT TYPES FOR CRUD OPERATIONS
// =====================================================================

export type CreateWhatsappUserInput = Omit<WhatsappUser, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateWhatsappUserInput = Partial<Omit<WhatsappUser, 'id' | 'phoneNumber' | 'createdAt' | 'updatedAt'>>;

export type CreateWhatsappConversationInput = Omit<WhatsappConversation, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateWhatsappConversationInput = Partial<Omit<WhatsappConversation, 'id' | 'userId' | 'agentId' | 'createdAt' | 'updatedAt'>>;

export type CreateWhatsappMessageInput = Omit<WhatsappMessage, 'id' | 'createdAt'>;
export type UpdateWhatsappMessageInput = Partial<Omit<WhatsappMessage, 'id' | 'conversationId' | 'createdAt'>>;

// =====================================================================
// RPC FUNCTION TYPES
// =====================================================================

/**
 * Nearby driver result from RPC function
 */
export interface RidesNearbyDriver {
  userId: string;
  distanceKm: number;
  currentLat: number;
  currentLng: number;
  lastSeenAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Nearby passenger result from RPC function
 */
export interface RidesNearbyPassenger {
  tripId: string;
  riderUserId: string;
  distanceKm: number;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress?: string;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insurance user request summary
 */
export interface InsuranceUserRequest {
  requestId: string;
  profileId: string;
  vehicleIdentifier?: string;
  requestType?: string;
  status: string;
  requestedAt: string;
  quoteDetails?: Record<string, unknown>;
}

/**
 * Apply intent result from RPC function
 */
export interface ApplyIntentResult {
  success: boolean;
  error?: string;
  action?: string;
  tripId?: string;
  profileId?: string;
  documentId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Intent application result
 */
export interface IntentApplicationResult {
  success: boolean;
  intentId: string;
  intentType: string;
  updatedEntities: Array<{
    table: string;
    id: string;
    action: string;
  }>;
  matches?: Array<{
    type: string;
    score: number;
    ref: Record<string, unknown>;
  }>;
  nextAction?: string;
  message?: string;
}

// =====================================================================
// STATUS CONSTANTS
// =====================================================================

/**
 * Conversation status constants for runtime use
 */
export const CONVERSATION_STATUSES = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  PAUSED: 'paused',
} as const;

/**
 * Intent status constants for runtime use
 */
export const INTENT_STATUSES = {
  PENDING: 'pending',
  APPLIED: 'applied',
  REJECTED: 'rejected',
} as const;

/**
 * Message direction constants for runtime use
 */
export const MESSAGE_DIRECTIONS = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;
