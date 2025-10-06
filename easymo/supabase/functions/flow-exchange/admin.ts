import type { SupabaseClient } from "./types.ts";
import type {
  FlowExchangeRequest,
  FlowExchangeResponse,
} from "../wa-webhook/types.ts";

type ActionPayload = {
  flow_id: string;
  action_id: string;
  screen_id?: string;
  wa_id?: string;
  session_id?: string;
  fields?: Record<string, unknown> | null;
  filters?: Record<string, unknown> | null;
  page_token?: string | null;
  context?: Record<string, unknown> | null;
};

type HandlerResult = {
  next_screen_id: string;
  data?: Record<string, unknown>;
  page_token_next?: string | null;
  messages?: Array<{ type: "info" | "warning" | "error"; text: string }>;
  field_errors?: Record<string, string>;
};

type LegacyHandler = (
  req: FlowExchangeRequest,
) => Promise<FlowExchangeResponse>;

type AdminOverrides = {
  legacyHandler?: LegacyHandler;
};

const bridgeScopes = globalThis as {
  __FLOW_EXCHANGE_ADMIN_OVERRIDES__?: AdminOverrides;
};

let cachedLegacyHandler: LegacyHandler | null = null;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function extractString(candidate: unknown): string | undefined {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (typeof candidate === "number" || typeof candidate === "boolean") {
    return String(candidate);
  }
  return undefined;
}

function resolveWaId(payload: ActionPayload): string | undefined {
  const direct = extractString(payload.wa_id);
  if (direct) return direct;
  const fields = asRecord(payload.fields);
  if (fields) {
    const candidate = extractString(fields["wa_id"]);
    if (candidate) return candidate;
  }
  const context = asRecord(payload.context);
  if (context) {
    const candidate = extractString(context["wa_id"]);
    if (candidate) return candidate;
  }
  const filters = asRecord(payload.filters);
  if (filters) {
    const candidate = extractString(filters["wa_id"]);
    if (candidate) return candidate;
  }
  return undefined;
}

function mapMessages(
  messages?: FlowExchangeResponse["messages"],
): HandlerResult["messages"] {
  if (!messages) return undefined;
  return messages.map((msg) => ({
    type: msg.level,
    text: msg.text,
  }));
}

function mapResponse(response: FlowExchangeResponse): HandlerResult {
  return {
    next_screen_id: response.next_screen_id,
    data: response.data ?? undefined,
    page_token_next: response.page_token_next ?? undefined,
    messages: mapMessages(response.messages),
    field_errors: response.field_errors ?? undefined,
  };
}

async function getLegacyHandler(
  overrides?: Partial<AdminOverrides>,
): Promise<LegacyHandler> {
  if (overrides?.legacyHandler) return overrides.legacyHandler;
  if (bridgeScopes.__FLOW_EXCHANGE_ADMIN_OVERRIDES__?.legacyHandler) {
    return bridgeScopes.__FLOW_EXCHANGE_ADMIN_OVERRIDES__!.legacyHandler!;
  }
  if (!cachedLegacyHandler) {
    const mod = await import("../wa-webhook/exchange/admin/router.ts");
    cachedLegacyHandler = mod.handleAdminFlow as LegacyHandler;
  }
  return cachedLegacyHandler;
}

export async function handleAdminAction(
  payload: ActionPayload,
  _supabase: SupabaseClient,
  overrides?: Partial<AdminOverrides>,
): Promise<HandlerResult> {
  const waId = resolveWaId(payload);
  const legacyRequest: FlowExchangeRequest = {
    flow_id: payload.flow_id,
    action_id: payload.action_id,
    screen_id: payload.screen_id ?? "",
    wa_id: waId ?? "",
    session_id: payload.session_id ?? "",
    fields: payload.fields ?? undefined,
    filters: payload.filters ?? undefined,
    page_token: payload.page_token ?? undefined,
    context: payload.context ?? undefined,
  };

  const legacyHandler = await getLegacyHandler(overrides);
  const response = await legacyHandler(legacyRequest);
  return mapResponse(response);
}

export function setAdminOverrides(overrides: AdminOverrides | null): void {
  if (!overrides) {
    delete bridgeScopes.__FLOW_EXCHANGE_ADMIN_OVERRIDES__;
    return;
  }
  bridgeScopes.__FLOW_EXCHANGE_ADMIN_OVERRIDES__ = overrides;
}

export type { HandlerResult };
