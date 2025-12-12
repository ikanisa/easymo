// Common types shared across all wa-webhook microservices

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

export interface RouterContext {
  supabase: SupabaseClient;
  profileId: string;
  phone: string;
  locale: string;
  correlationId: string;
  timestamp: number;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "interactive" | "location" | "image" | "video" | "audio" | "document";
  text?: { body: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  image?: { id: string; mime_type: string; sha256: string };
  video?: { id: string; mime_type: string; sha256: string };
  audio?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; mime_type: string; sha256: string; filename: string };
}

export interface ChatState {
  flow?: string;
  step?: string;
  data?: Record<string, unknown>;
  lastActivity?: string;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}
