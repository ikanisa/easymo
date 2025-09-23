import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import type { SupabaseClient } from './types.ts';
import {
  handleShowBarResults,
  handlePagedBars,
  handleBarDetail,
  handleCategories,
  handleItems,
  handleItemDetail,
  type CustomerRequestPayload,
} from './customer.ts';
import {
  handleAddToCart,
  handleViewCart,
  handleUpdateCartLine,
  handlePlaceOrder,
  handleCustomerPaidSignal,
  handleOrderStatus,
} from './customer-cart.ts';
import {
  handleOnboardIdentity,
  handleOnboardContacts,
  handleOnboardUploaded,
  handleOnboardPublish,
  handleOnboardReview,
} from './vendor-onboarding.ts';
import {
  handleCategoryList,
  handleCategoryMove,
  handleCategoryRename,
  handleCategoryAdd,
  handleItemsList,
  handleItemToggle,
  handleItemSave,
  handleItemCreate,
  handleBulkPrices,
} from './vendor-menu.ts';
import {
  handleVendorQueue,
  handleVendorOrderDetail,
  handleVendorMarkPaid,
  handleVendorMarkServed,
  handleVendorCancel,
} from './vendor-orders.ts';
import {
  handleStaffList,
  handleStaffAdd,
  handleStaffRemove,
  handleSaveSettings,
} from './vendor-staff-settings.ts';

const ACTIONS = {
  CUSTOMER: {
    SHOW_RESULTS: 'a_show_results',
    PAGE_BARS: 'a_paged_bars',
    SELECT_BAR: 'a_select_bar',
    OPEN_MENU: 'a_open_menu',
    SELECT_CATEGORY: 'a_select_category',
    OPEN_ITEMS: 'a_open_items',
    PAGE_ITEMS: 'a_paged_items',
    OPEN_ITEM: 'a_open_item',
    ADD_TO_CART: 'a_add_to_cart',
    VIEW_CART: 'a_view_cart',
    EDIT_CART: 'a_edit_cart',
    UPDATE_LINE: 'a_update_line',
    PLACE_ORDER: 'a_place_order',
    CUSTOMER_PAID_SIGNAL: 'a_customer_paid_signal',
    VIEW_STATUS: 'a_view_status',
    REFRESH_ORDERS: 'a_refresh_orders',
    OPEN_ORDER_DETAIL: 'a_open_order',
  },
  VENDOR: {
    ONBOARD_IDENTITY: 'a_onboard_identity',
    ONBOARD_CONTACTS: 'a_onboard_contacts',
    ONBOARD_UPLOADED: 'a_onboard_uploaded',
    PUBLISH_MENU: 'a_publish_menu',
    OPEN_MENU_REVIEW: 'a_open_menu_review',
    CAT_MOVE: 'a_cat_move',
    CAT_RENAME: 'a_cat_rename',
    CAT_ADD: 'a_cat_add',
    OPEN_ITEMS: 'a_open_items',
    ITEM_TOGGLE: 'a_item_toggle',
    ITEM_EDIT_OPEN: 'a_item_edit_open',
    ITEM_SAVE: 'a_item_save',
    ITEM_CREATE: 'a_item_create',
    BULK_PRICES: 'a_bulk_prices',
    ORDER_VIEW_QUEUE: 'a_view_queue',
    ORDER_OPEN_DETAIL: 'a_open_order_detail',
    ORDER_MARK_PAID: 'a_mark_paid',
    ORDER_MARK_SERVED: 'a_mark_served',
    ORDER_CANCEL_CONFIRM: 'a_confirm_cancel',
    STAFF_REFRESH: 'a_staff_refresh',
    STAFF_ADD: 'a_staff_add',
    STAFF_REMOVE: 'a_staff_remove',
    SAVE_SETTINGS: 'a_save_settings',
  },
} as const;

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
  messages: z.array(z.object({ type: z.enum(['info', 'warning', 'error']), text: z.string() })).optional(),
  field_errors: z.record(z.string()).optional(),
});

function getSupabaseClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service credentials');
  }
  const authHeader = req.headers.get('Authorization');
  return createClient(url, serviceKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    },
  });
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: ActionPayload;
  try {
    const json = await req.json();
    payload = requestSchema.parse(json);
  } catch (error) {
    console.error('Invalid request payload', error);
    return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400 });
  }

  const supabase = getSupabaseClient(req);

  try {
    const result = await routeAction(payload, supabase);
    return new Response(JSON.stringify(responseSchema.parse(result)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('flow-exchange error', error);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
}

type ActionPayload = z.infer<typeof requestSchema>;
type HandlerResult = z.infer<typeof responseSchema>;
type ActionHandler = (
  payload: ActionPayload,
  supabase: SupabaseClient
) => Promise<HandlerResult>;

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
  supabase: SupabaseClient
): Promise<HandlerResult> {
  const handler = ROUTES[payload.action_id] ?? unsupported;
  if (handler === unsupported) {
    console.warn('Unhandled action_id', payload.action_id);
  }
  return handler(payload, supabase);
}

function toCustomerPayload(payload: ActionPayload): CustomerRequestPayload {
  return {
    filters: (payload.filters ?? undefined) as Record<string, unknown> | undefined,
    page_token: payload.page_token ?? undefined,
    fields: payload.fields ?? undefined,
    context: payload.context ?? undefined,
    bar_id: (payload as Record<string, unknown>).bar_id as string | undefined,
    menu_id: (payload as Record<string, unknown>).menu_id as string | undefined,
    category_id: (payload as Record<string, unknown>).category_id as string | undefined,
    subcategory_id: (payload as Record<string, unknown>).subcategory_id as string | undefined,
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

serve(handleRequest);
