/**
 * Buy & Sell Agent Type Definitions
 * 
 * TypeScript interfaces for the Buy & Sell agent enhancement:
 * - WhatsApp message payloads
 * - Intent extraction
 * - Vendor management
 * - Sourcing workflow
 */

// WhatsApp webhook payload (WhatsApp Cloud Business API)
export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "audio" | "image" | "document" | "button" | "interactive";
  text?: {
    body: string;
  };
  audio?: {
    id: string;
    mime_type: string;
  };
  image?: {
    id: string;
    mime_type: string;
    caption?: string;
  };
  button?: {
    text: string;
    payload: string;
  };
  interactive?: {
    type: string;
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
    };
  };
  context?: {
    message_id: string;
  };
}

// Extracted intent from user message
export interface ExtractedIntent {
  need_type: "product" | "service" | "medicine" | "general";
  description: string;
  quantity?: string;
  urgency?: "urgent" | "today" | "this_week" | "flexible";
  location?: string;
  special_requirements?: string[];
  confidence: number;
}

// Vendor candidate from search
export interface VendorCandidate {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  place_id?: string;
  source: "google_search" | "google_maps" | "existing_vendor";
  score?: number;
  is_onboarded?: boolean;
  created_at?: string;
}

// Internal vendor record
export interface Vendor {
  id: string;
  business_name: string;
  phone: string;
  lat?: number;
  lng?: number;
  is_opted_in: boolean;
  is_onboarded: boolean;
  average_rating: number;
  positive_response_count: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

// Vendor inquiry/request
export interface VendorInquiry {
  id: string;
  buyer_phone: string;
  buyer_profile_id?: string;
  request_summary: string;
  request_type: "product" | "service" | "medicine" | "general";
  business_ids: string[];
  status: "pending" | "sent" | "completed" | "failed" | "cancelled";
  vendors_contacted: number;
  vendors_responded: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  metadata?: Record<string, any>;
}

// Vendor response to inquiry
export interface VendorResponse {
  id: string;
  inquiry_id: string;
  business_id: string;
  business_name: string;
  business_phone?: string;
  message_sent: string;
  sent_at: string;
  responded_at?: string;
  status: "sent" | "delivered" | "read" | "responded" | "failed";
  response_text?: string;
  error_message?: string;
  created_at: string;
}

// WhatsApp broadcast request
export interface WhatsAppBroadcastRequest {
  id: string;
  request_id: string;
  user_location_label?: string;
  need_description: string;
  status: "pending" | "sent" | "completed" | "failed";
  created_at: string;
}

// WhatsApp broadcast target
export interface WhatsAppBroadcastTarget {
  id: string;
  broadcast_id: string;
  business_name: string;
  business_phone: string;
  country_code?: string;
  status: "pending" | "sent" | "delivered" | "failed";
  message_sid?: string;
  created_at: string;
}

// WhatsApp business reply
export interface WhatsAppBusinessReply {
  id: string;
  business_phone: string;
  raw_body: string;
  action?: "HAVE_IT" | "NO_STOCK" | "STOP_MESSAGES";
  has_stock?: boolean;
  broadcast_target_id?: string;
  created_at: string;
}

// Sourcing request
export interface SourcingRequest {
  id: string;
  user_id: string;
  intent_json: Record<string, any>;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

// Job queue entry
export interface Job {
  id: string;
  user_id: string;
  type: string;
  payload_json: Record<string, any>;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// Conversation state
export interface ConversationState {
  id: string;
  user_id: string;
  state_json: {
    step: string;
    data?: Record<string, any>;
  };
  created_at: string;
  updated_at: string;
}

// Inbound message audit
export interface InboundMessage {
  id: string;
  user_id?: string;
  type?: string;
  text?: string;
  media_url?: string;
  wa_message_id?: string;
  created_at: string;
}

// Opt-out record
export interface WhatsAppOptOut {
  id: string;
  business_phone: string;
  reason?: string;
  created_at: string;
}
