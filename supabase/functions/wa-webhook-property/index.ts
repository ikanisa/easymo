// wa-webhook-property - Dedicated Property Microservice
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import type { RouterContext, WhatsAppWebhookPayload, RawWhatsAppMessage } from "../_shared/wa-webhook-shared/types.ts";
import { getState } from "../_shared/wa-webhook-shared/state/store.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";

// Property domain imports
import {
  startPropertyRentals,
  handlePropertyMenuSelection,
  handleRoleSelection,
  handleFindPropertyType,
  handleFindPropertyBedrooms,
  handleFindPropertyDuration,
  handleFindPropertyBudget,
  handleFindPropertyLocation,
  handleAddPropertyType,
  handleAddPropertyBedrooms,
  handleAddPropertyPriceUnit,
  handleAddPropertyPrice,
  handleAddPropertyLocation,
  handlePropertyAIChat,
  startPropertySavedLocationPicker,
  handlePropertySavedLocationSelection,
  type PropertyFindState,
  type PropertyAddState,
  type PropertySavedPickerState,
} from "./property/rentals.ts";

// Location handler
import { cachePropertyLocation } from "./handlers/location-handler.ts";

// My listings imports
import {
  showMyProperties,
  handlePropertyDetailView,
  handlePropertyActions,
  promptInquiryMessage,
  handleInquiryMessage,
} from "./property/my_listings.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request): Promise<Response> => {
  // Rate limiting (100 req/min for high-volume WhatsApp)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "wa-webhook-property");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = async (
    event: string,
    payload?: Record<string, unknown>,
  ) => {
    await logStructuredEvent(event, {
      service: "wa-webhook-property",
      requestId,
      correlationId,
      ...payload,
    });
  };

  try {
    // Health check
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname.endsWith("/health"))) {
      return respond({
        status: "healthy",
        service: "wa-webhook-property",
        timestamp: new Date().toISOString(),
      });
    }

    // Only accept POST requests
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed" }, { status: 405 });
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const signatureMeta = (() => {
      if (!signature) {
        return {
          provided: false,
          header: signatureHeader,
          method: null as string | null,
          sample: null as string | null,
        };
      }
      const [method, hash] = signature.split("=", 2);
      return {
        provided: true,
        header: signatureHeader,
        method: method?.toLowerCase() ?? null,
        sample: hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : null,
      };
    })();
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";

    if (!appSecret) {
      await logEvent("PROPERTY_AUTH_CONFIG_ERROR", { reason: "missing_app_secret" });
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
        if (isValidSignature) {
          await logEvent("PROPERTY_SIGNATURE_VALID", {
            signatureHeader,
            signatureMethod: signatureMeta.method,
          });
        }
      } catch (err) {
        await logEvent("PROPERTY_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        await logEvent("PROPERTY_AUTH_BYPASS", {
          reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
          signatureHeader,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        });
      } else {
        await logEvent("PROPERTY_AUTH_FAILED", {
          signatureProvided: signatureMeta.provided,
          signatureHeader,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        });
        return respond({ error: "unauthorized" }, { status: 401 });
      }
    }

    let payload: WhatsAppWebhookPayload;
    try {
      payload = rawBody ? JSON.parse(rawBody) as WhatsAppWebhookPayload : {} as WhatsAppWebhookPayload;
    } catch (parseError) {
      await logEvent("PROPERTY_PAYLOAD_INVALID_JSON", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return respond({ error: "invalid_payload" }, { status: 400 });
    }

    await logEvent("PROPERTY_WEBHOOK_RECEIVED", {
      entry_count: payload.entry?.length ?? 0,
    });

    // Extract first message
    const message = getFirstMessage(payload);
    if (!message) {
      await logEvent("PROPERTY_NO_MESSAGE");
      return respond({ success: true, message: "No message to process" });
    }

    // Build context
    const ctx: RouterContext = await buildContext(message, payload);

    // Get user state
    const state = ctx.profileId
      ? await getState(supabase, ctx.profileId)
      : { key: "home", data: {} };

    await logEvent("PROPERTY_STATE", { state: state.key });

    // Route based on message type
    let handled = false;

    try {
      // Handle interactive buttons
      if (message.type === "interactive" && message.interactive?.type === "button_reply") {
        const buttonId = message.interactive.button_reply?.id;
        handled = await handlePropertyButton(ctx, buttonId, state);
      }

      // Handle interactive lists
      if (message.type === "interactive" && message.interactive?.type === "list_reply") {
        const listId = message.interactive.list_reply?.id;
        handled = await handlePropertyList(ctx, listId, state);
      }

      // Handle location messages
      if (message.type === "location" && message.location) {
        handled = await handlePropertyLocation(ctx, message, state);
      }

      // Handle text messages
      if (!handled && message.type === "text") {
        handled = await handlePropertyText(ctx, message, state);
      }

      if (!handled) {
        await logEvent("PROPERTY_UNHANDLED", { messageType: message.type });
      }

      return respond({ success: true, handled });

    } catch (error) {
      await logEvent("PROPERTY_HANDLER_ERROR", { error: String(error) });
      return respond({ error: "Handler error", details: String(error) }, { status: 500 });
    }

  } catch (error) {
    await logEvent("PROPERTY_ERROR", { error: String(error) });
    return respond({ error: String(error) }, { status: 500 });
  }
});

function getFirstMessage(payload: WhatsAppWebhookPayload): RawWhatsAppMessage | null {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      if (messages && messages.length > 0) {
        return messages[0];
      }
    }
  }
  return null;
}

async function buildContext(
  message: RawWhatsAppMessage,
  _payload: WhatsAppWebhookPayload,
): Promise<RouterContext> {
  const from = message.from;

  // Auto-create profile if needed
  const { ensureProfile } = await import("../_shared/wa-webhook-shared/utils/profile.ts");
  const profile = await ensureProfile(supabase, from);

  return {
    from,
    profileId: profile?.user_id ?? null,
    locale: profile?.language || "en",
    supabase,
  };
}

async function handlePropertyButton(
  ctx: RouterContext,
  buttonId: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  // RE-Fix 1: Handle role selection buttons
  if (buttonId.startsWith("re_role_")) {
    return await handleRoleSelection(ctx, buttonId);
  }

  // Handle property button selections
  if (buttonId === IDS.PROPERTY_RENTALS || buttonId === "property" || buttonId === "property_rentals") {
    await startPropertyRentals(ctx);
    return true;
  }

  // Handle My Properties
  if (buttonId === "MY_PROPERTIES") {
    return await showMyProperties(ctx);
  }

  // Handle menu selections
  if ([IDS.PROPERTY_FIND, IDS.PROPERTY_ADD, IDS.PROPERTY_CHAT_AI, IDS.BACK_HOME].includes(buttonId)) {
    return await handlePropertyMenuSelection(ctx, buttonId);
  }

  // Handle property actions
  if (buttonId.startsWith("PROP_EDIT::")) {
    const propertyId = buttonId.replace("PROP_EDIT::", "");
    return await handlePropertyActions(ctx, propertyId, "edit");
  }

  if (buttonId.startsWith("PROP_DELETE::")) {
    const propertyId = buttonId.replace("PROP_DELETE::", "");
    return await handlePropertyActions(ctx, propertyId, "delete");
  }

  if (buttonId.startsWith("PROP_STATUS::")) {
    const propertyId = buttonId.replace("PROP_STATUS::", "");
    // Show status menu
    await ctx.supabase; // placeholder for status menu
    return true;
  }

  if (buttonId.startsWith("PROP_INQUIRE::")) {
    const propertyId = buttonId.replace("PROP_INQUIRE::", "");
    return await promptInquiryMessage(ctx, propertyId);
  }

  // Handle saved location picker
  if (buttonId === IDS.LOCATION_SAVED_LIST && state.key === "property_find_location") {
    const findState = state.data as PropertyFindState;
    return await startPropertySavedLocationPicker(ctx, "find", findState);
  }

  if (buttonId === IDS.LOCATION_SAVED_LIST && state.key === "property_add_location") {
    const addState = state.data as PropertyAddState;
    return await startPropertySavedLocationPicker(ctx, "add", addState);
  }

  return false;
}

async function handlePropertyList(
  ctx: RouterContext,
  listId: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  // Handle property menu entry
  if (listId === "property" || listId === "property_rentals" || listId === "real_estate_agent") {
    await startPropertyRentals(ctx);
    return true;
  }

  // Handle My Properties
  if (listId === "MY_PROPERTIES") {
    return await showMyProperties(ctx);
  }

  // View specific property
  if (listId.startsWith("VIEW_PROP::")) {
    const propertyId = listId.replace("VIEW_PROP::", "");
    return await handlePropertyDetailView(ctx, propertyId);
  }

  // Handle menu selections
  if ([IDS.PROPERTY_FIND, IDS.PROPERTY_ADD, IDS.PROPERTY_CHAT_AI, IDS.BACK_HOME].includes(listId)) {
    return await handlePropertyMenuSelection(ctx, listId);
  }

  // Handle find property flow
  if (state.key === "property_find_type") {
    return await handleFindPropertyType(ctx, listId);
  }

  if (state.key === "property_find_bedrooms") {
    return await handleFindPropertyBedrooms(ctx, state.data as { rentalType: string }, listId);
  }

  // Handle add property flow
  if (state.key === "property_add_type") {
    return await handleAddPropertyType(ctx, listId);
  }

  if (state.key === "property_add_bedrooms") {
    return await handleAddPropertyBedrooms(ctx, state.data as { rentalType: string }, listId);
  }

  if (state.key === "property_add_price_unit") {
    return await handleAddPropertyPriceUnit(
      ctx,
      state.data as { rentalType: string; bedrooms: string },
      listId
    );
  }

  // Handle saved location selection
  if (state.key === "location_saved_picker") {
    const pickerState = state.data as PropertySavedPickerState;
    return await handlePropertySavedLocationSelection(ctx, pickerState, listId);
  }

  return false;
}

/**
 * Save user's shared location to cache (30-minute TTL)
 * Allows reusing location across property searches without re-sharing
 */
async function cachePropertyLocation(
  ctx: RouterContext,
  lat: number,
  lng: number
): Promise<void> {
  try {
    if (!ctx.profileId) return;
    
    await ctx.supabase.rpc('update_user_location_cache', {
      _user_id: ctx.profileId,
      _lat: lat,
      _lng: lng,
    });
    
    console.log(JSON.stringify({
      event: "PROPERTY_LOCATION_CACHED",
      userId: ctx.profileId,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "PROPERTY_LOCATION_CACHE_FAILED",
      error: String(error),
    }));
  }
}

async function handlePropertyLocation(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const location = message.location;
  if (!location?.latitude || !location?.longitude) return false;

  // Save to location cache (30-min TTL) for all property location shares
  await cachePropertyLocation(ctx, location.latitude, location.longitude);

  // Handle find property location
  if (state.key === "property_find_location") {
    const findState = state.data as PropertyFindState;
    return await handleFindPropertyLocation(ctx, findState, {
      lat: location.latitude,
      lng: location.longitude,
    });
  }

  // Handle add property location
  if (state.key === "property_add_location") {
    const addState = state.data as PropertyAddState;
    return await handleAddPropertyLocation(ctx, addState, {
      lat: location.latitude,
      lng: location.longitude,
    });
  }

  return false;
}

async function handlePropertyText(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const text = message.text?.body?.trim();
  if (!text) return false;

  // Handle inquiry message
  if (state.key === "property_inquiry") {
    const propertyId = state.data?.propertyId as string;
    if (propertyId) {
      return await handleInquiryMessage(ctx, propertyId, text);
    }
  }

  // Handle AI chat mode
  if (state.key === "property_ai_chat") {
    return await handlePropertyAIChat(ctx, text);
  }

  // Handle duration input for short-term rentals
  if (state.key === "property_find_duration") {
    const duration = text.match(/\d+/)?.[0];
    if (duration) {
      return await handleFindPropertyDuration(
        ctx,
        state.data as { rentalType: string; bedrooms: string },
        duration
      );
    }
  }

  // Handle budget input
  if (state.key === "property_find_budget") {
    const budget = text.replace(/[^\d]/g, "");
    if (budget) {
      return await handleFindPropertyBudget(
        ctx,
        state.data as { rentalType: string; bedrooms: string; currency?: string; duration?: string },
        budget
      );
    }
  }

  // Handle price input for adding property
  if (state.key === "property_add_price") {
    const price = text.replace(/[^\d]/g, "");
    if (price) {
      return await handleAddPropertyPrice(
        ctx,
        state.data as { rentalType: string; bedrooms: string; currency?: string; priceUnit?: string },
        price
      );
    }
  }

  // Handle property-related keywords
  const lowerText = text.toLowerCase();
  if (["property", "estate", "rent", "house", "apartment", "rental"].some(kw => lowerText.includes(kw))) {
    await startPropertyRentals(ctx);
    return true;
  }

  return false;
}

await logStructuredEvent("LOG", { data: "wa-webhook-property service started" });
