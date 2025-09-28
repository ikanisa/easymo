import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import type { SupabaseClient } from "./types.ts";
import {
  type CustomerRequestPayload,
  handleBarDetail,
  handleCategories,
  handleItemDetail,
  handleItems,
  handlePagedBars,
  handleShowBarResults,
} from "./customer.ts";
import {
  handleAddToCart,
  handleCustomerPaidSignal,
  handleOrderStatus,
  handlePlaceOrder,
  handleUpdateCartLine,
  handleViewCart,
} from "./customer-cart.ts";
import {
  handleOnboardContacts,
  handleOnboardIdentity,
  handleOnboardPublish,
  handleOnboardReview,
  handleOnboardUploaded,
} from "./vendor-onboarding.ts";
import {
  handleBulkPrices,
  handleCategoryAdd,
  handleCategoryList,
  handleCategoryMove,
  handleCategoryRename,
  handleItemCreate,
  handleItemSave,
  handleItemsList,
  handleItemToggle,
} from "./vendor-menu.ts";
import {
  handleVendorCancel,
  handleVendorMarkPaid,
  handleVendorMarkServed,
  handleVendorOrderDetail,
  handleVendorQueue,
} from "./vendor-orders.ts";
import {
  handleSaveSettings,
  handleStaffAdd,
  handleStaffList,
  handleStaffRemove,
} from "./vendor-staff-settings.ts";

import {
  decryptFlowEnvelope,
  encryptFlowPayload,
  type FlowEncryptionContext,
  isEncryptedEnvelope,
} from "../_shared/flow_crypto.ts";

const REQUIRED_ENVS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

for (const key of REQUIRED_ENVS) {
  if (!Deno.env.get(key)) {
    console.warn(`flow-exchange missing env: ${key}`);
  }
}

function logFlow(scope: string, details: Record<string, unknown>) {
  console.info(`flow-exchange.${scope}`, details);
}

const ACTIONS = {
  CUSTOMER: {
    SHOW_RESULTS: "a_show_results",
    PAGE_BARS: "a_paged_bars",
    SELECT_BAR: "a_select_bar",
    OPEN_MENU: "a_open_menu",
    SELECT_CATEGORY: "a_select_category",
    OPEN_ITEMS: "a_open_items",
    PAGE_ITEMS: "a_paged_items",
    OPEN_ITEM: "a_open_item",
    ADD_TO_CART: "a_add_to_cart",
    VIEW_CART: "a_view_cart",
    EDIT_CART: "a_edit_cart",
    UPDATE_LINE: "a_update_line",
    PLACE_ORDER: "a_place_order",
    CUSTOMER_PAID_SIGNAL: "a_customer_paid_signal",
    VIEW_STATUS: "a_view_status",
    REFRESH_ORDERS: "a_refresh_orders",
    OPEN_ORDER_DETAIL: "a_open_order",
  },
  VENDOR: {
    ONBOARD_IDENTITY: "a_onboard_identity",
    ONBOARD_CONTACTS: "a_onboard_contacts",
    ONBOARD_UPLOADED: "a_onboard_uploaded",
    PUBLISH_MENU: "a_publish_menu",
    OPEN_MENU_REVIEW: "a_open_menu_review",
    CAT_MOVE: "a_cat_move",
    CAT_RENAME: "a_cat_rename",
    CAT_ADD: "a_cat_add",
    OPEN_ITEMS: "a_open_items",
    ITEM_TOGGLE: "a_item_toggle",
    ITEM_EDIT_OPEN: "a_item_edit_open",
    ITEM_SAVE: "a_item_save",
    ITEM_CREATE: "a_item_create",
    BULK_PRICES: "a_bulk_prices",
    ORDER_VIEW_QUEUE: "a_view_queue",
    ORDER_OPEN_DETAIL: "a_open_order_detail",
    ORDER_MARK_PAID: "a_mark_paid",
    ORDER_MARK_SERVED: "a_mark_served",
    ORDER_CANCEL_CONFIRM: "a_confirm_cancel",
    STAFF_REFRESH: "a_staff_refresh",
    STAFF_ADD: "a_staff_add",
    STAFF_REMOVE: "a_staff_remove",
    SAVE_SETTINGS: "a_save_settings",
  },
} as const;

const DEFAULT_FLOW_ID = "flow.cust.bar_browser.v1";

type FlowRequestEnvelope = {
  version?: string;
  action?: string;
  screen?: string;
  data?: Record<string, unknown> | null;
  flow_token?: string;
  payload?: Record<string, unknown> | null;
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

const requestSchema = z.object({
  flow_id: z.string(),
  screen_id: z.string().optional(),
  action_id: z.string(),
  wa_id: z.string().optional(),
  session_id: z.string().optional(),
  fields: z.record(z.any()).nullable().optional(),
  filters: z.record(z.any()).nullable().optional(),
  page_token: z.string().nullable().optional(),
  context: z.record(z.any()).nullable().optional(),
});

const responseSchema = z.object({
  next_screen_id: z.string(),
  data: z.record(z.any()).optional(),
  page_token_next: z.string().nullable().optional(),
  messages: z.array(
    z.object({ type: z.enum(["info", "warning", "error"]), text: z.string() }),
  ).optional(),
  field_errors: z.record(z.string()).optional(),
});

function getSupabaseClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service credentials");
  }
  const authHeader = req.headers.get("Authorization");
  return createClient(url, serviceKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    },
  });
}

async function handleRequest(req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const url = new URL(req.url);
    logFlow("request", { method: req.method, path: url.pathname });
  } catch {
    logFlow("request", { method: req.method });
  }
  if (req.method !== "POST") {
    logFlow("response", { status: 405, duration_ms: Date.now() - started });
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    const json = await req.json();
    body = json as Record<string, unknown>;
  } catch (error) {
    console.error("Invalid request payload", error);
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isEncrypted = isEncryptedEnvelope(body);

  if (isEncrypted) {
    try {
      const { request: flowEnvelope, context } = await decryptFlowEnvelope<
        FlowRequestEnvelope
      >(body);
      const normalized = normalizeRequest(flowEnvelope);

      if (normalized.actionType === "PING") {
        const response = await respondEncrypted(
          { data: { status: "active" } },
          context,
        );
        logFlow("response", {
          status: response.status,
          duration_ms: Date.now() - started,
          action: "PING",
        });
        return response;
      }
      if (normalized.actionType === "ERROR_NOTIFICATION") {
        const response = await respondEncrypted({
          data: { acknowledged: true },
        }, context);
        logFlow("response", {
          status: response.status,
          duration_ms: Date.now() - started,
          action: "ERROR_NOTIFICATION",
        });
        return response;
      }

      const payload = buildActionPayload(flowEnvelope, normalized);
      const supabase = getSupabaseClient(req);
      const result = await routeAction(payload, supabase);
      const flowResponse = buildFlowResponse(result);
      const response = await respondEncrypted(flowResponse, context);
      logFlow("response", {
        status: response.status,
        duration_ms: Date.now() - started,
        action: normalized.actionId ?? normalized.actionType ?? "unknown",
      });
      return response;
    } catch (error) {
      console.error("flow-exchange decrypt error", error);
      if (
        error instanceof Error && error.message.includes("FLOW_PRIVATE_KEY")
      ) {
        logFlow("response", { status: 421, duration_ms: Date.now() - started });
        return new Response("Unable to decrypt request", { status: 421 });
      }
      if (error instanceof DOMException) {
        logFlow("response", { status: 421, duration_ms: Date.now() - started });
        return new Response("Unable to decrypt request", { status: 421 });
      }
      logFlow("response", { status: 400, duration_ms: Date.now() - started });
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logFlow("response", { status: 400, duration_ms: Date.now() - started });
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: ActionPayload;
  try {
    payload = requestSchema.parse(body);
  } catch (error) {
    console.error("Invalid request payload", error);
    logFlow("response", { status: 400, duration_ms: Date.now() - started });
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseClient(req);

  try {
    const result = await routeAction(payload, supabase);
    const parsed = responseSchema.parse(result);
    logFlow("response", {
      status: 200,
      action: payload.action_id,
      duration_ms: Date.now() - started,
    });
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("flow-exchange error", error);
    logFlow("response", { status: 500, duration_ms: Date.now() - started });
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

type ActionPayload = z.infer<typeof requestSchema>;
type HandlerResult = z.infer<typeof responseSchema>;
type ActionHandler = (
  payload: ActionPayload,
  supabase: SupabaseClient,
) => Promise<HandlerResult>;

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

  const payloadRoot = isRecord(request.payload) ? request.payload : undefined;
  const searchRoot = payloadRoot ?? dataRoot;

  const actionIdValue = findValueByKey(searchRoot, "action_id");
  if (typeof actionIdValue === "string" && actionIdValue.startsWith("a_")) {
    actionId = actionIdValue;
  } else {
    const deep = findStringStartingWith(searchRoot, "a_");
    if (deep) actionId = deep;
  }

  const fieldsCandidate = findValueByKey(searchRoot, "fields");
  const filtersCandidate = findValueByKey(searchRoot, "filters");
  const pageTokenValue = findValueByKey(searchRoot, "page_token");

  const fields = isRecord(fieldsCandidate)
    ? fieldsCandidate
    : (isRecord(dataRoot) ? dataRoot : {});
  const filters = isRecord(filtersCandidate) ? filtersCandidate : {};

  let pageToken: string | null = null;
  const pageTokenStr = toStringValue(pageTokenValue);
  if (pageTokenStr !== undefined) {
    pageToken = pageTokenStr;
  }

  if (!pageToken && typeof fields["page_token"] === "string") {
    pageToken = fields["page_token"] as string;
  }

  if (!actionId && actionType && actionType.startsWith("A_")) {
    actionId = actionType.toLowerCase();
  }

  return {
    actionType,
    actionId,
    screen: typeof request.screen === "string" ? request.screen : undefined,
    fields,
    filters,
    pageToken,
  };
}

function buildActionPayload(
  envelope: FlowRequestEnvelope,
  normalized: NormalizedRequest,
): ActionPayload {
  let actionId = normalized.actionId;
  if (!actionId && normalized.actionType === "INIT") {
    actionId = ACTIONS.CUSTOMER.SHOW_RESULTS;
  }
  if (!actionId) {
    throw new Error(
      `Missing action identifier for action ${
        normalized.actionType ?? "unknown"
      }`,
    );
  }

  const flowIdCandidate = findStringStartingWith(envelope, "flow.");
  const flowId = flowIdCandidate ?? DEFAULT_FLOW_ID;

  const fields = normalized.fields;
  const filters = normalized.filters;

  const waId = toStringValue(fields["wa_id"] ?? filters["wa_id"]);
  const sessionId = toStringValue(
    fields["session_id"] ?? filters["session_id"],
  );

  const context: Record<string, unknown> = {};
  if (envelope.flow_token) {
    context.flow_token = envelope.flow_token;
  }

  const payload: ActionPayload = {
    flow_id: flowId,
    screen_id: normalized.screen,
    action_id: actionId,
    page_token: normalized.pageToken,
    fields: Object.keys(fields).length ? fields : undefined,
    filters: Object.keys(filters).length ? filters : undefined,
    context: Object.keys(context).length ? context : undefined,
  };

  if (waId) payload.wa_id = waId;
  if (sessionId) payload.session_id = sessionId;

  return payload;
}

function buildFlowResponse(result: HandlerResult): FlowResponsePayload {
  const data = { ...(result.data ?? {}) } as Record<string, unknown>;
  if (result.page_token_next !== undefined) {
    data.page_token_next = result.page_token_next;
  }
  if (result.messages?.length) {
    const errorMessage = result.messages.find((msg) => msg.type === "error") ??
      result.messages[0];
    if (errorMessage) {
      data.error_message = errorMessage.text;
    }
  }
  if (result.field_errors) {
    data.field_errors = result.field_errors;
  }
  return {
    screen: result.next_screen_id,
    data,
  };
}

const unsupported: ActionHandler = async (payload) => {
  throw new Error(`Unsupported action_id: ${payload.action_id}`);
};

const ROUTES: Record<string, ActionHandler> = {
  [ACTIONS.CUSTOMER.SHOW_RESULTS]: async (payload, supabase) =>
    handleShowBarResults(toCustomerPayload(payload), supabase),
  [ACTIONS.CUSTOMER.PAGE_BARS]: async (payload, supabase) =>
    handlePagedBars(toCustomerPayload(payload), supabase),
  [ACTIONS.CUSTOMER.SELECT_BAR]: async (payload, supabase) =>
    handleBarDetail(toCustomerPayload(payload), supabase),
  [ACTIONS.CUSTOMER.OPEN_MENU]: async (payload, supabase) =>
    handleCategories(toCustomerPayload(payload), supabase),
  [ACTIONS.CUSTOMER.SELECT_CATEGORY]: async (payload, supabase) =>
    handleItems(toCustomerPayload(payload), supabase),
  [ACTIONS.CUSTOMER.OPEN_ITEMS]: async (payload, supabase) =>
    handleItems(toCustomerPayload(payload), supabase),
  [ACTIONS.CUSTOMER.PAGE_ITEMS]: async (payload, supabase) =>
    handleItems(toCustomerPayload(payload), supabase),
  [ACTIONS.CUSTOMER.OPEN_ITEM]: async (payload, supabase) =>
    handleItemDetail(toCustomerPayload(payload), supabase),
  [ACTIONS.CUSTOMER.ADD_TO_CART]: async (payload, supabase) =>
    handleAddToCart(toCartPayload(payload), supabase),
  [ACTIONS.CUSTOMER.VIEW_CART]: async (payload, supabase) =>
    handleViewCart(toCartPayload(payload), supabase),
  [ACTIONS.CUSTOMER.EDIT_CART]: async (payload, supabase) =>
    handleViewCart(toCartPayload(payload), supabase),
  [ACTIONS.CUSTOMER.UPDATE_LINE]: async (payload, supabase) =>
    handleUpdateCartLine(toCartPayload(payload), supabase),
  [ACTIONS.CUSTOMER.PLACE_ORDER]: async (payload, supabase) =>
    handlePlaceOrder(toCartPayload(payload), supabase),
  [ACTIONS.CUSTOMER.CUSTOMER_PAID_SIGNAL]: async (payload, supabase) =>
    handleCustomerPaidSignal(toCartPayload(payload), supabase),
  [ACTIONS.CUSTOMER.VIEW_STATUS]: async (payload, supabase) =>
    handleOrderStatus(toCartPayload(payload), supabase),
  [ACTIONS.CUSTOMER.REFRESH_ORDERS]: async (payload, supabase) =>
    handleOrderStatus(toCartPayload(payload), supabase),
  [ACTIONS.CUSTOMER.OPEN_ORDER_DETAIL]: async (payload, supabase) =>
    handleOrderStatus(toCartPayload(payload), supabase),
  [ACTIONS.VENDOR.ONBOARD_IDENTITY]: async (payload, supabase) =>
    handleOnboardIdentity(payload, supabase),
  [ACTIONS.VENDOR.ONBOARD_CONTACTS]: async (payload, supabase) =>
    handleOnboardContacts(payload, supabase),
  [ACTIONS.VENDOR.ONBOARD_UPLOADED]: async (payload) =>
    handleOnboardUploaded(payload),
  [ACTIONS.VENDOR.PUBLISH_MENU]: async (payload, supabase) =>
    handleOnboardPublish(payload, supabase),
  [ACTIONS.VENDOR.OPEN_MENU_REVIEW]: async (payload, supabase) =>
    handleOnboardReview(payload, supabase),
  [ACTIONS.VENDOR.CAT_MOVE]: async (payload, supabase) =>
    handleCategoryMove(payload, supabase),
  [ACTIONS.VENDOR.CAT_RENAME]: async (payload, supabase) =>
    handleCategoryRename(payload, supabase),
  [ACTIONS.VENDOR.CAT_ADD]: async (payload, supabase) =>
    handleCategoryAdd(payload, supabase),
  [ACTIONS.VENDOR.OPEN_ITEMS]: async (payload, supabase) =>
    handleItemsList(payload, supabase),
  [ACTIONS.VENDOR.ITEM_TOGGLE]: async (payload, supabase) =>
    handleItemToggle(payload, supabase),
  [ACTIONS.VENDOR.ITEM_EDIT_OPEN]: async (payload, supabase) =>
    handleItemsList(payload, supabase),
  [ACTIONS.VENDOR.ITEM_SAVE]: async (payload, supabase) =>
    handleItemSave(payload, supabase),
  [ACTIONS.VENDOR.ITEM_CREATE]: async (payload, supabase) =>
    handleItemCreate(payload, supabase),
  [ACTIONS.VENDOR.BULK_PRICES]: async (payload, supabase) =>
    handleBulkPrices(payload, supabase),
  [ACTIONS.VENDOR.ORDER_VIEW_QUEUE]: async (payload, supabase) =>
    handleVendorQueue(payload, supabase),
  [ACTIONS.VENDOR.ORDER_OPEN_DETAIL]: async (payload, supabase) =>
    handleVendorOrderDetail(payload, supabase),
  [ACTIONS.VENDOR.ORDER_MARK_PAID]: async (payload, supabase) =>
    handleVendorMarkPaid(payload, supabase),
  [ACTIONS.VENDOR.ORDER_MARK_SERVED]: async (payload, supabase) =>
    handleVendorMarkServed(payload, supabase),
  [ACTIONS.VENDOR.ORDER_CANCEL_CONFIRM]: async (payload, supabase) =>
    handleVendorCancel(payload, supabase),
  [ACTIONS.VENDOR.STAFF_REFRESH]: async (payload, supabase) =>
    handleStaffList(payload, supabase),
  [ACTIONS.VENDOR.STAFF_ADD]: async (payload, supabase) =>
    handleStaffAdd(payload, supabase),
  [ACTIONS.VENDOR.STAFF_REMOVE]: async (payload, supabase) =>
    handleStaffRemove(payload, supabase),
  [ACTIONS.VENDOR.SAVE_SETTINGS]: async (payload, supabase) =>
    handleSaveSettings(payload, supabase),
};

async function routeAction(
  payload: ActionPayload,
  supabase: SupabaseClient,
): Promise<HandlerResult> {
  const handler = ROUTES[payload.action_id] ?? unsupported;
  if (handler === unsupported) {
    console.warn("Unhandled action_id", payload.action_id);
  }
  return handler(payload, supabase);
}

function toCustomerPayload(payload: ActionPayload): CustomerRequestPayload {
  return {
    filters: (payload.filters ?? undefined) as
      | Record<string, unknown>
      | undefined,
    page_token: payload.page_token ?? undefined,
    fields: payload.fields ?? undefined,
    context: payload.context ?? undefined,
    bar_id: (payload as Record<string, unknown>).bar_id as string | undefined,
    menu_id: (payload as Record<string, unknown>).menu_id as string | undefined,
    category_id: (payload as Record<string, unknown>).category_id as
      | string
      | undefined,
    subcategory_id: (payload as Record<string, unknown>).subcategory_id as
      | string
      | undefined,
  };
}

function toCartPayload(payload: ActionPayload) {
  return {
    ...toCustomerPayload(payload),
    wa_id: payload.wa_id ?? payload.fields?.wa_id ?? payload.context?.wa_id,
    fields: payload.fields ?? undefined,
    context: payload.context ?? undefined,
  };
}

const denoWithMocks = Deno as typeof Deno & {
  __FLOW_EXCHANGE_MOCKS__?: { serve?: typeof Deno.serve };
};

const serveFn = denoWithMocks.__FLOW_EXCHANGE_MOCKS__?.serve ?? Deno.serve;

serveFn(handleRequest);
