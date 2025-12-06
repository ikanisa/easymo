import type { SupabaseClient } from "./deps.ts";
import type { SupportedLanguage } from "./i18n/language.ts";
import type {
  DetectionResult,
  ToneLocale,
} from "../../../../packages/localization/src/index.ts";

export type RouterContext = {
  supabase: SupabaseClient;
  from: string; // customer/vendor WhatsApp E164 number
  profileId?: string; // optional profile.user_id
  locale: SupportedLanguage;
  toneLocale?: ToneLocale;
  toneDetection?: DetectionResult;
};

export type ButtonSpec = {
  id: string;
  title: string;
};

export type FlowExchangeRequest = {
  flow_id: string;
  screen_id: string;
  action_id: string;
  wa_id: string;
  session_id: string;
  fields?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  page_token?: string | null;
  context?: Record<string, unknown>;
};

export type FlowExchangeResponse = {
  next_screen_id: string;
  data?: Record<string, unknown>;
  page_token_next?: string | null;
  messages?: Array<{ level: "info" | "warning" | "error"; text: string }>;
  field_errors?: Record<string, string>;
};

export type WhatsAppMessage = {
  id: string;
  from: string;
  type: string;
  [key: string]: unknown;
};

// CORRECTED: Make RawWhatsAppMessage a union of all specific message types
export type RawWhatsAppMessage =
  | WhatsAppTextMessage
  | WhatsAppInteractiveMessage
  | WhatsAppInteractiveButtonMessage
  | WhatsAppInteractiveListMessage
  | WhatsAppLocationMessage
  | WhatsAppImageMessage
  | WhatsAppDocumentMessage
  | WhatsAppAudioMessage
  | (WhatsAppMessage & Record<string, unknown>); // Fallback for unknown types

export type WhatsAppTextMessage = WhatsAppMessage & {
  type: "text";
  text?: {
    body?: string | null;
    [key: string]: unknown;
  } | null;
};

export type WhatsAppInteractiveMessage = WhatsAppMessage & {
  type: "interactive";
  interactive?: {
    type?: string | null;
    button_reply?: {
      id?: string | null;
      title?: string | null;
      [key: string]: unknown;
    } | null;
    list_reply?: {
      id?: string | null;
      title?: string | null;
      description?: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
};

export type WhatsAppInteractiveButtonMessage = WhatsAppInteractiveMessage & {
  interactive?: {
    type?: string | null;
    button_reply?: {
      id?: string | null;
      title?: string | null;
      [key: string]: unknown;
    } | null;
  } | null;
};

export type WhatsAppInteractiveListMessage = WhatsAppInteractiveMessage & {
  interactive?: {
    type?: string | null;
    list_reply?: {
      id?: string | null;
      title?: string | null;
      description?: string | null;
      [key: string]: unknown;
    } | null;
  } | null;
};

export type WhatsAppLocationMessage = WhatsAppMessage & {
  type: "location";
  location?: {
    latitude?: string | number | null;
    longitude?: string | number | null;
    name?: string | null;
    address?: string | null;
    [key: string]: unknown;
  } | null;
};

export type WhatsAppImageMessage = WhatsAppMessage & {
  type: "image";
  image?: {
    id?: string | null;
    [key: string]: unknown;
  } | null;
};

export type WhatsAppDocumentMessage = WhatsAppMessage & {
  type: "document";
  document?: {
    id?: string | null;
    [key: string]: unknown;
  } | null;
};

export type WhatsAppAudioMessage = WhatsAppMessage & {
  type: "audio";
  audio?: {
    id?: string | null;
    mime_type?: string | null;
    voice?: boolean | null;
    [key: string]: unknown;
  } | null;
};

export type WhatsAppMediaMessage =
  | WhatsAppImageMessage
  | WhatsAppDocumentMessage
  | WhatsAppAudioMessage;

export type WhatsAppWebhookPayload = {
  object?: string;
  entry?: WhatsAppWebhookEntry[];
};

export type WhatsAppWebhookEntry = {
  id?: string;
  time?: number;
  changes?: WhatsAppWebhookChange[];
};

export type WhatsAppWebhookChange = {
  field?: string;
  value?: WhatsAppChangeValue;
};

export type WhatsAppCallEvent = {
  id: string;
  from: string;
  to: string;
  event: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';
  timestamp?: string;
};

export type WhatsAppChangeValue = {
  messaging_product?: string;
  metadata?: WhatsAppChangeMetadata;
  contacts?: WhatsAppContact[];
  messages?: RawWhatsAppMessage[];
  statuses?: Record<string, unknown>[];
  call?: WhatsAppCallEvent;
  [key: string]: unknown;
};

export type WhatsAppChangeMetadata = {
  display_phone_number?: string | null;
  phone_number_id?: string | null;
  [key: string]: unknown;
};

export type WhatsAppContactProfile = {
  name?: string | null;
  language?: string | null;
  locale?: string | null;
  [key: string]: unknown;
};

export type WhatsAppContact = {
  wa_id?: string | null;
  waId?: string | null;
  profile?: WhatsAppContactProfile | null;
  language?: string | null;
  locale?: string | null;
  [key: string]: unknown;
};

export type FlowActionHandler = (
  req: FlowExchangeRequest,
) => Promise<FlowExchangeResponse>;