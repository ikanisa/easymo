/**
 * Type definitions for Buy & Sell agent
 * 
 * These types support:
 * - WhatsApp message processing
 * - Intent extraction
 * - Vendor management
 * - Sourcing and outreach
 */

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "audio" | "image" | "location" | "video" | "document";
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
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

export interface ExtractedIntent {
  need_type: "buy" | "sell" | "service" | "unknown";
  query: string;
  specs?: string;
  budget?: string;
  urgency?: "immediate" | "soon" | "flexible";
  location?: {
    lat: number;
    lng: number;
    label: string;
  };
  confidence?: number;
}

export interface VendorCandidate {
  name: string;
  phone?: string;
  address?: string;
  place_id?: string;
  source: "google_maps" | "google_search" | "database" | "manual";
  score: number;
  is_onboarded: boolean;
  lat?: number;
  lng?: number;
  tags?: string[];
}

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
  country_code?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorInquiry {
  vendor_id: string;
  business_name: string;
  phone: string;
  need_description: string;
  user_location?: string;
  broadcast_id: string;
  created_at: string;
}

export interface VendorResponse {
  inquiry_id: string;
  vendor_phone: string;
  action: "HAVE_IT" | "NO_STOCK" | "STOP_MESSAGES" | "UNKNOWN";
  has_stock: boolean;
  raw_message?: string;
  created_at: string;
}

export interface BroadcastRequest {
  request_id: string;
  user_location_label?: string;
  need_description: string;
  target_vendors: {
    business_name: string;
    business_phone: string;
    country_code?: string;
  }[];
}

export interface BroadcastTarget {
  id: string;
  broadcast_id: string;
  business_name: string;
  business_phone: string;
  country_code?: string;
  status: "pending" | "sent" | "failed" | "delivered";
  message_sid?: string;
  created_at: string;
}

export interface Job {
  id: string;
  user_id?: string;
  type: string;
  payload_json: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationState {
  step: "COLLECT_INTENT" | "ASK_OUTREACH" | "AWAITING_VENDOR_REPLIES" | "COMPLETED";
  intent?: ExtractedIntent;
  sourcing_request_id?: string;
  candidate_count?: number;
  broadcast_id?: string;
  blocked_market?: boolean;
}
