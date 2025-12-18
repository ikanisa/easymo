/**
 * Shared Type Definitions for Buy & Sell Agent
 * 
 * Centralized type definitions used across the sourcing agent system
 */

// =====================================================
// WHATSAPP MESSAGE TYPES
// =====================================================

export interface WhatsAppMessage {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts: { profile: { name: string }; wa_id: string }[];
        messages: {
          from: string;
          id: string;
          timestamp: string;
          type: "text" | "audio" | "location" | "interactive" | "image";
          text?: { body: string };
          audio?: { id: string; mime_type: string };
          image?: { id: string; mime_type: string; caption?: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          interactive?: { 
            button_reply?: { id: string; title: string }; 
            list_reply?: { id: string; title: string } 
          };
        }[];
      };
      field: string;
    }[];
  }[];
}

// =====================================================
// INTENT EXTRACTION TYPES
// =====================================================

export interface ExtractedIntent {
  need_type: "product" | "service" | "medicine" | "unknown";
  query: string;
  specs: Record<string, unknown>;
  budget: { currency: string; max: number | null };
  urgency: "now" | "today" | "this_week" | "flexible";
  location: { lat: number | null; lng: number | null; text: string | null };
  country_code: string | null;
  blocked_market: boolean;
  is_missing_info: boolean;
  missing_info_question: string | null;
  detected_language: string; // e.g. "en", "fr", "sw", "rw"
  confidence?: number; // 0-1
}

// =====================================================
// VENDOR TYPES
// =====================================================

export interface VendorCandidate {
  id?: string; // UUID if internal
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  lat?: number;
  lng?: number;
  google_maps_uri?: string;
  place_id?: string;
  source: "google_maps" | "google_search" | "internal_db";
  score?: number;
  reason?: string;
  is_onboarded: boolean;
  rating?: number;
}

export interface Vendor {
  id: string;
  business_name: string;
  phone: string;
  lat: number;
  lng: number;
  is_opted_in: boolean;
  is_onboarded: boolean;
  average_rating: number;
  positive_response_count: number;
}

export interface VendorInquiry {
  id: string;
  request_id: string;
  vendor_id: string;
  status: string;
  sent_at: string;
  vendors?: {
    phone: string;
    business_name: string;
  };
}

export interface VendorResponse {
  id: string;
  inquiry_id: string;
  vendor_id: string;
  raw_text: string;
  availability?: string;
  created_at: string;
}

// =====================================================
// SOURCING REQUEST TYPES
// =====================================================

export interface SourcingRequest {
  id: string;
  user_id: string;
  user_phone: string;
  intent_json: ExtractedIntent;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

// =====================================================
// MARKET KNOWLEDGE TYPES
// =====================================================

export interface MarketKnowledge {
  id: string;
  fact_text: string;
  tags: string[];
  created_at: string;
  source?: string;
  confidence?: number;
}

// =====================================================
// BROADCAST TYPES
// =====================================================

export interface BroadcastRequest {
  id: string;
  request_id: string;
  user_location_label?: string;
  need_description: string;
  status: "processing" | "sent" | "error";
  created_at: string;
}

export interface BroadcastTarget {
  id: string;
  broadcast_id: string;
  business_name: string;
  business_phone: string;
  country_code?: string;
  status: "pending" | "sent" | "error";
  twilio_message_sid?: string;
  created_at: string;
}

// =====================================================
// JOB QUEUE TYPES
// =====================================================

export interface Job {
  id: string;
  user_id: string;
  job_type: "sourcing" | "broadcast" | "notification";
  payload_json: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  priority: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
}

// =====================================================
// USER CONTEXT TYPES
// =====================================================

export interface UserContext {
  pastRequests: Array<{
    intent_json: ExtractedIntent;
    status: string;
    created_at: string;
  }>;
  globalKnowledge: MarketKnowledge[];
  userPreferences?: {
    preferredLanguage?: string;
    preferredCurrency?: string;
    defaultLocation?: { lat: number; lng: number };
  };
}
