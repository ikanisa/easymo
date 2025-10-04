import type { SupabaseClient } from "./deps.ts";
import type { SupportedLanguage } from "./i18n/language.ts";

export type RouterContext = {
  supabase: SupabaseClient;
  from: string; // customer/vendor WhatsApp E164 number
  profileId?: string; // optional profile.user_id
  locale: SupportedLanguage;
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

export type FlowActionHandler = (
  req: FlowExchangeRequest,
) => Promise<FlowExchangeResponse>;
