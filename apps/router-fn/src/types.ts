export interface WhatsAppMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title?: string };
    list_reply?: { id: string; title?: string };
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

export interface NormalizedMessage {
  from: string;
  messageId: string;
  type: string;
  text?: string;
  keywordCandidate?: string;
  interactive?: { type: string; id: string; title?: string };
  media?: { type: string; id: string; caption?: string };
  metadata?: { phoneNumberId?: string; displayPhoneNumber?: string };
}

export interface RouteDestination {
  routeKey: string;
  destinationUrl: string;
  priority: number;
}

export interface KeywordMapping {
  keyword: string;
  routeKey: string;
}

export interface ProcessedMessageResult {
  messageId: string;
  outcome: "routed" | "duplicate" | "rate_limited" | "unmatched" | "error";
  routeKey?: string;
  destinations?: string[];
  error?: string;
}

export interface RouterLogPayload {
  messageId: string;
  routeKey?: string;
  status: string;
  textSnippet?: string;
  metadata: Record<string, unknown>;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
}

export interface RouterRepository {
  loadKeywordMappings(): Promise<KeywordMapping[]>;
  loadDestinations(): Promise<RouteDestination[]>;
  claimMessage(
    messageId: string,
    waFrom: string,
    routeKey: string,
    metadata?: Record<string, unknown>,
  ): Promise<boolean>;
  checkRateLimit(
    waFrom: string,
    windowSeconds: number,
    maxMessages: number,
  ): Promise<RateLimitResult>;
  recordRouterLog(payload: RouterLogPayload): Promise<void>;
}
