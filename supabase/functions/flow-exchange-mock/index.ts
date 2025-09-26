import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  decryptFlowEnvelope,
  encryptFlowPayload,
  type FlowEncryptionContext,
  isEncryptedEnvelope,
} from "../_shared/flow_crypto.ts";

const SAMPLE_AREAS = [
  { id: "all", title: "All areas" },
  { id: "downtown", title: "Downtown" },
  { id: "remera", title: "Remera" },
  { id: "nyamirambo", title: "Nyamirambo" },
];

const SAMPLE_BARS_PAGE_1 = [
  { id: "bar-alpha", title: "Bar Alpha", description: "Downtown · Kigali" },
  { id: "bar-bravo", title: "Bar Bravo", description: "Remera · Kigali" },
  {
    id: "bar-charlie",
    title: "Bar Charlie",
    description: "Nyamirambo · Kigali",
  },
];

const SAMPLE_BARS_PAGE_2 = [
  { id: "bar-delta", title: "Bar Delta", description: "Kacyiru · Kigali" },
  { id: "bar-echo", title: "Bar Echo", description: "Kicukiro · Kigali" },
  { id: "bar-foxtrot", title: "Bar Foxtrot", description: "Gisozi · Kigali" },
];

type FlowRequestEnvelope = {
  version?: string;
  action?: string;
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
};

type FlowResponsePayload = {
  screen: string;
  data: Record<string, unknown>;
};

type FlowAckPayload = { data: { acknowledged: true } };
type FlowHealthPayload = { data: { status: "active" } };
type FlowPayload = FlowResponsePayload | FlowAckPayload | FlowHealthPayload;

async function respondEncrypted(
  payload: FlowPayload,
  context: EncryptionContext,
): Promise<Response> {
  const body = await encryptFlowPayload(payload, context);
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

type EncryptionContext = FlowEncryptionContext;

async;
async;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findValueByKey(root: unknown, key: string): unknown {
  if (isRecord(root)) {
    if (key in root) {
      return root[key];
    }
    for (const value of Object.values(root)) {
      const found = findValueByKey(value, key);
      if (found !== undefined) return found;
    }
  } else if (Array.isArray(root)) {
    for (const value of root) {
      const found = findValueByKey(value, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function findStringStartingWith(
  root: unknown,
  prefix: string,
): string | undefined {
  if (typeof root === "string") {
    if (root.startsWith(prefix)) return root;
    return undefined;
  }
  if (isRecord(root)) {
    for (const value of Object.values(root)) {
      const found = findStringStartingWith(value, prefix);
      if (found) return found;
    }
  } else if (Array.isArray(root)) {
    for (const value of root) {
      const found = findStringStartingWith(value, prefix);
      if (found) return found;
    }
  }
  return undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

type NormalizedRequest = {
  actionType?: string;
  actionId?: string;
  screen?: string;
  fields: Record<string, unknown>;
  filters: Record<string, unknown>;
  pageToken: string | null;
};

function normalizeRequest(request: FlowRequestEnvelope): NormalizedRequest {
  const dataRoot = isRecord(request.data) ? request.data : undefined;
  let actionType = typeof request.action === "string"
    ? request.action.toUpperCase()
    : undefined;
  let actionId: string | undefined;
  const actionIdValue = findValueByKey(dataRoot, "action_id");
  if (typeof actionIdValue === "string" && actionIdValue.startsWith("a_")) {
    actionId = actionIdValue;
  } else {
    const deep = findStringStartingWith(dataRoot, "a_");
    if (deep) actionId = deep;
  }
  const fieldsCandidate = findValueByKey(dataRoot, "fields");
  const filtersCandidate = findValueByKey(dataRoot, "filters");
  const pageTokenValue = findValueByKey(dataRoot, "page_token");
  const fields = isRecord(fieldsCandidate) ? fieldsCandidate : dataRoot ?? {};
  const filters = isRecord(filtersCandidate) ? filtersCandidate : {};
  let pageToken: string | null = null;
  if (typeof pageTokenValue === "string") {
    pageToken = pageTokenValue;
  } else if (pageTokenValue === null) {
    pageToken = null;
  }
  if (
    !pageToken &&
    typeof (fields as Record<string, unknown>).page_token === "string"
  ) {
    pageToken = String((fields as Record<string, unknown>).page_token);
  }
  if (!actionId && actionType && actionType.startsWith("A_")) {
    actionId = actionType.toLowerCase();
  }
  return {
    actionType,
    actionId,
    screen: typeof request.screen === "string" ? request.screen : undefined,
    fields: isRecord(fields) ? fields : {},
    filters,
    pageToken,
  };
}

function getStringField(
  source: Record<string, unknown>,
  key: string,
  fallback: string | null = null,
): string | null {
  const value = source[key];
  const str = toStringValue(value);
  return str ?? fallback;
}

function buildInitResponse(normalized: NormalizedRequest): FlowResponsePayload {
  const q = getStringField(normalized.fields, "q", "") ?? "";
  const area = getStringField(normalized.fields, "area", "all") ?? "all";
  return {
    screen: "s_find_bar",
    data: {
      areas: SAMPLE_AREAS,
      q,
      area,
      helper_text: "Mock search data loaded from Supabase Edge Function.",
    },
  };
}

function buildResultsResponse(
  page: "PAGE_1" | "PAGE_2",
  normalized: NormalizedRequest,
): FlowResponsePayload {
  const q = getStringField(normalized.fields, "q") ??
    getStringField(normalized.filters, "q", "") ?? "";
  const area = getStringField(normalized.fields, "area") ??
    getStringField(normalized.filters, "area", "all") ?? "all";
  const bars = page === "PAGE_2" ? SAMPLE_BARS_PAGE_2 : SAMPLE_BARS_PAGE_1;
  const pageTokenPrev = page === "PAGE_2" ? "PAGE_1" : null;
  const pageTokenNext = page === "PAGE_1" ? "PAGE_2" : null;
  return {
    screen: "s_bar_results",
    data: {
      bars,
      q,
      area,
      page_token_prev: pageTokenPrev,
      page_token_next: pageTokenNext,
    },
  };
}

function lookupBar(barId?: string | null) {
  const allBars = [...SAMPLE_BARS_PAGE_1, ...SAMPLE_BARS_PAGE_2];
  if (!barId) return allBars[0];
  return allBars.find((bar) => bar.id === barId) ?? allBars[0];
}

function buildBarDetailResponse(barId?: string | null): FlowResponsePayload {
  const bar = lookupBar(barId ?? undefined);
  return {
    screen: "s_bar_detail",
    data: {
      bar_id: barId ?? bar.id,
      bar_name: bar.title,
      location_text: `${bar.description} · Rwanda`,
      momo_supported: "Yes",
      direct_chat_allowed: "false",
      bar_chat_url: "",
      highlights: [
        "Happy hour 5-7pm",
        "Signature cocktails",
        "Live music on Fridays",
      ],
    },
  };
}

function buildMenuResponse(barId?: string | null): FlowResponsePayload {
  const detail = buildBarDetailResponse(barId);
  return {
    screen: detail.screen,
    data: {
      ...detail.data,
      menu_preview: [
        {
          id: "section-classics",
          title: "Classic Cocktails",
          items: [
            {
              id: "item-negroni",
              title: "Negroni",
              price: "8.00",
              currency: "USD",
            },
            {
              id: "item-mojito",
              title: "Mojito",
              price: "7.50",
              currency: "USD",
            },
          ],
        },
        {
          id: "section-snacks",
          title: "Bar Snacks",
          items: [
            {
              id: "item-samosa",
              title: "Beef Samosa",
              price: "4.00",
              currency: "USD",
            },
            {
              id: "item-plantain",
              title: "Fried Plantain",
              price: "3.50",
              currency: "USD",
            },
          ],
        },
      ],
      message: "Menu preview is mocked. Replace with live data later.",
    },
  };
}

function buildFlowResponse(normalized: NormalizedRequest): FlowPayload {
  const actionType = normalized.actionType ?? "";
  if (actionType === "PING") {
    return { data: { status: "active" } };
  }
  if (actionType === "ERROR_NOTIFICATION") {
    return { data: { acknowledged: true } };
  }
  if (actionType === "INIT" && !normalized.actionId) {
    return buildInitResponse(normalized);
  }

  const actionId = normalized.actionId;
  switch (actionId) {
    case "a_show_results":
      return buildResultsResponse("PAGE_1", normalized);
    case "a_paged_bars": {
      const page = normalized.pageToken === "PAGE_2" ? "PAGE_2" : "PAGE_1";
      return buildResultsResponse(page, normalized);
    }
    case "a_select_bar": {
      const barId = getStringField(normalized.fields, "bar_id");
      return buildBarDetailResponse(barId);
    }
    case "a_open_menu": {
      const barId = getStringField(normalized.fields, "bar_id");
      return buildMenuResponse(barId);
    }
    default:
      return {
        screen: normalized.screen ?? "s_find_bar",
        data: {
          error_message: `Unsupported action ${
            actionId ?? actionType ?? "unknown"
          }`,
        },
      };
  }
}

function toFlowRequestEnvelope(
  body: Record<string, unknown>,
): FlowRequestEnvelope {
  if (typeof body.action_id === "string") {
    return {
      action: "DATA_EXCHANGE",
      screen: typeof body.screen_id === "string" ? body.screen_id : undefined,
      data: {
        action_id: body.action_id,
        fields: isRecord(body.fields) ? body.fields : undefined,
        filters: isRecord(body.filters) ? body.filters : undefined,
        page_token: typeof body.page_token === "string"
          ? body.page_token
          : undefined,
      },
    };
  }
  return body as FlowRequestEnvelope;
}

async function handleClearRequest(
  request: FlowRequestEnvelope,
  context?: EncryptionContext,
): Promise<Response> {
  const normalized = normalizeRequest(request);
  const payload = buildFlowResponse(normalized);
  if (context) {
    return respondEncrypted(payload, context);
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

serve(async (req) => {
  if (req.method === "GET") {
    return new Response("flow-exchange-mock ok", { status: 200 });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const isEncrypted = isEncryptedEnvelope(body);

  try {
    if (isEncrypted) {
      const { request, context } = await decryptFlowEnvelope<
        FlowRequestEnvelope
      >(body);
      return await handleClearRequest(request, context);
    }
    const envelope = toFlowRequestEnvelope(body);
    return await handleClearRequest(envelope);
  } catch (error) {
    console.error("flow-exchange-mock error", error);
    if (isEncrypted) {
      if (
        error instanceof Error && error.message.includes("FLOW_PRIVATE_KEY")
      ) {
        return new Response("Unable to decrypt request", { status: 421 });
      }
      if (error instanceof DOMException) {
        return new Response("Unable to decrypt request", { status: 421 });
      }
    }
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
});
