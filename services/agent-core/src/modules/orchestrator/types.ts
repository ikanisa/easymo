/**
 * Agent Session Types
 * 
 * Core types for agent orchestration and negotiation sessions.
 */

export type FlowType =
  | "nearby_drivers"
  | "nearby_pharmacies"
  | "nearby_quincailleries"
  | "nearby_shops"
  | "scheduled_trip"
  | "recurring_trip"
  | "ai_waiter";

export type SessionStatus =
  | "searching"
  | "negotiating"
  | "presenting"
  | "completed"
  | "timeout"
  | "cancelled"
  | "error";

export type QuoteStatus =
  | "pending"
  | "received"
  | "accepted"
  | "rejected"
  | "expired"
  | "withdrawn";

export type VendorType =
  | "driver"
  | "pharmacy"
  | "quincaillerie"
  | "shop"
  | "restaurant"
  | "other";

export interface AgentSession {
  id: string;
  userId: string;
  flowType: FlowType;
  status: SessionStatus;
  requestData: Record<string, unknown>;
  startedAt: Date;
  deadlineAt: Date;
  quotesCollected: Quote[];
  selectedQuoteId?: string;
  resultData?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quote {
  id: string;
  sessionId: string;
  vendorId?: string;
  vendorType: VendorType;
  vendorName?: string;
  vendorPhone?: string;
  offerData: Record<string, unknown>;
  status: QuoteStatus;
  priceAmount?: number;
  priceCurrency?: string;
  estimatedTimeMinutes?: number;
  notes?: string;
  sentAt?: Date;
  receivedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionRequest {
  userId: string;
  flowType: FlowType;
  requestData: Record<string, unknown>;
  windowMinutes?: number; // Default 5 minutes
}

export interface CreateQuoteRequest {
  sessionId: string;
  vendorId?: string;
  vendorType: VendorType;
  vendorName?: string;
  vendorPhone?: string;
  offerData: Record<string, unknown>;
  priceAmount?: number;
  priceCurrency?: string;
  estimatedTimeMinutes?: number;
  notes?: string;
  expiresInMinutes?: number;
}

export interface NegotiationResult {
  sessionId: string;
  status: SessionStatus;
  quotesReceived: number;
  bestQuote?: Quote;
  allQuotes: Quote[];
  timeElapsed: number;
  timedOut: boolean;
}

export interface VendorContactInfo {
  id?: string;
  name: string;
  phone: string;
  type: VendorType;
  metadata?: Record<string, unknown>;
}
