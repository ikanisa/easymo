/**
 * Unified Types for All Domain Agents
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// CORE MESSAGE TYPES
// =====================================================

export interface WhatsAppMessage {
  from: string;
  body: string;
  type: string;
  timestamp: string;
  id: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  interactive?: {
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

// =====================================================
// SESSION MANAGEMENT
// =====================================================

export interface UnifiedSession {
  id: string;
  userPhone: string;
  userId?: string;
  
  // Current agent context
  currentAgent: AgentType;
  
  // Flow management
  activeFlow?: string;
  flowStep?: string;
  collectedData: Record<string, any>;
  
  // Conversation history
  conversationHistory: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
  }>;
  
  // Location context
  location?: {
    lat: number;
    lng: number;
    text?: string;
  };
  
  // Status
  status: "active" | "completed" | "expired";
  lastMessageAt: string;
  expiresAt: string;
}

// =====================================================
// AGENT TYPES
// =====================================================

/**
 * Official 10 agents matching production agent_registry database.
 */
export type AgentType =
  | "farmer"           // Farmer AI Agent
  | "insurance"        // Insurance AI Agent
  | "sales_cold_caller" // Sales/Marketing Cold Caller AI Agent
  | "rides"            // Rides AI Agent
  | "jobs"             // Jobs AI Agent
  | "waiter"           // Waiter AI Agent
  | "real_estate"      // Real Estate AI Agent
  | "marketplace"      // Marketplace AI Agent (includes pharmacy, hardware, shop)
  | "support"          // Support AI Agent (includes concierge routing)
  | "business_broker"; // Business Broker AI Agent (includes legal intake)

export interface AgentDependencies {
  supabase: SupabaseClient;
  correlationId: string;
}

export interface AgentResponse {
  text: string;
  interactiveList?: {
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  };
  interactiveButtons?: Array<{
    id: string;
    title: string;
  }>;
  handoffTo?: AgentType;
  handoffReason?: string;
  flowComplete?: boolean;
}

// =====================================================
// INTENT CLASSIFICATION
// =====================================================

export interface ClassifiedIntent {
  agentType: AgentType;
  confidence: number;
  reason: string;
  keywords?: string[];
}

export interface AIResponse {
  text: string;
  intent?: string;
  extractedEntities?: Record<string, any>;
  startFlow?: string;
  handoffTo?: AgentType;
  handoffReason?: string;
  toolCalls?: Array<{
    name: string;
    parameters: Record<string, any>;
  }>;
  flowComplete?: boolean;
}

// =====================================================
// TOOL DEFINITIONS
// =====================================================

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

// =====================================================
// DATABASE TYPES
// =====================================================

export interface UnifiedListing {
  id: string;
  ownerPhone: string;
  ownerUserId?: string;
  
  // Listing type
  domain: "marketplace" | "jobs" | "property" | "farmer";
  listingType: "product" | "service" | "job" | "rental" | "produce";
  
  // Common fields
  title: string;
  description?: string;
  category?: string;
  
  // Pricing
  price?: number;
  priceMax?: number;
  currency: string;
  priceUnit?: string;
  
  // Location
  locationText?: string;
  lat?: number;
  lng?: number;
  
  // Domain-specific data
  attributes: Record<string, any>;
  
  // Media
  images?: string[];
  
  // Status
  status: "active" | "sold" | "rented" | "expired";
  sourceAgent: string;
  createdAt: string;
  expiresAt?: string;
}

export interface UnifiedApplication {
  id: string;
  listingId: string;
  applicantPhone: string;
  applicantUserId?: string;
  
  // Application type
  domain: "jobs" | "property" | "marketplace";
  
  // Common fields
  message?: string;
  
  // Domain-specific
  attributes: Record<string, any>;
  
  // Status
  status: "pending" | "accepted" | "rejected";
  respondedAt?: string;
  createdAt: string;
}

// =====================================================
// WHATSAPP API TYPES
// =====================================================

export interface WhatsAppTextMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: {
    body: string;
  };
}

export interface WhatsAppInteractiveMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "interactive";
  interactive: {
    type: "list" | "button";
    header?: {
      type: "text";
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      button?: string;
      buttons?: Array<{
        type: "reply";
        reply: {
          id: string;
          title: string;
        };
      }>;
      sections?: Array<{
        title?: string;
        rows: Array<{
          id: string;
          title: string;
          description?: string;
        }>;
      }>;
    };
  };
}
