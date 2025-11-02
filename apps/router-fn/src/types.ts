export interface WhatsAppMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string };
  };
  image?: { id: string; caption?: string };
  document?: { id: string; caption?: string };
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: WhatsAppMessage[];
      };
      field?: string;
    }>;
  }>;
}

export interface NormalizedPayload {
  from: string;
  messageId: string;
  type: string;
  text?: string;
  keyword?: string;
  interactive?: { type: string; id: string; title?: string };
  media?: { type: string; id: string; caption?: string };
  metadata?: { phoneNumberId?: string; displayPhoneNumber?: string };
}

export interface DestinationRecord {
  keyword: string;
  destinationSlug: string;
  destinationUrl: string;
}

export interface RouteResult {
  keyword: string;
  destinationUrl: string;
  destinationSlug: string;
  status: number;
  responseTime: number;
  error?: string;
}

export type TelemetryEvent =
  | "message_accepted"
  | "message_duplicate"
  | "message_rate_limited"
  | "keyword_unmatched"
  | "message_routed"
  | "downstream_error";

export interface TelemetryRecord {
  event: TelemetryEvent;
  messageId?: string;
  keyword?: string;
  metadata?: Record<string, unknown>;
}
