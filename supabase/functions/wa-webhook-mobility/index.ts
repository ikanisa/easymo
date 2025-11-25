// wa-webhook-mobility - Standalone version
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "./deps.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getState } from "./state/store.ts";
import {
  handleSeeDrivers,
  handleSeePassengers,
  handleVehicleSelection,
  handleNearbyLocation,
  handleNearbyResultSelection,
  handleChangeVehicleRequest,
  handleUseCachedLocation,
  startNearbySavedLocationPicker,
  handleNearbySavedLocationSelection,
  isVehicleOption,
} from "./handlers/nearby.ts";
import {
  startScheduleTrip,
  handleScheduleRole,
  handleScheduleVehicle,
  handleScheduleChangeVehicle,
  handleScheduleLocation,
  handleScheduleDropoff,
  handleScheduleSkipDropoff,
  handleScheduleTimeSelection,
  handleScheduleRecurrenceSelection,
  handleScheduleRefresh,
  startScheduleSavedLocationPicker,
  handleScheduleSavedLocationSelection,
} from "./handlers/schedule.ts";
import {
  startGoOnline,
  handleGoOnlineLocation,
  handleGoOnlineUseCached,
  handleGoOffline,
} from "./handlers/go_online.ts";
import {
  routeDriverAction,
} from "./handlers/driver_response.ts";
import {
  driverInsuranceStateKey,
  parseInsuranceState,
  handleInsuranceCertificateUpload,
} from "./handlers/driver_insurance.ts";
// Full integration - All handlers enabled (using console.log for logging)
import {
  handleTripStart,
  handleTripArrivedAtPickup,
  handleTripPickedUp,
  handleTripComplete,
  handleTripCancel,
  handleTripRate,
} from "./handlers/trip_lifecycle.ts";
import {
  startDriverTracking,
  updateDriverLocation,
  stopDriverTracking,
  getDriverLocation,
} from "./handlers/tracking.ts";
import {
  calculateFareEstimate,
} from "./handlers/fare.ts";
import type { RouterContext, WhatsAppWebhookPayload, RawWhatsAppMessage } from "./types.ts";
import { IDS } from "./wa/ids.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = (
    event: string,
    details: Record<string, unknown> = {},
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, {
      service: "wa-webhook-mobility",
      requestId,
      path: url.pathname,
      ...details,
    }, level);
  };

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return respond({ status: "healthy", service: "wa-webhook-mobility" });
  }

  // Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Main webhook handler
  try {
    // Read raw body for signature verification
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
      logEvent("MOBILITY_AUTH_CONFIG_ERROR", { reason: "missing_app_secret" }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
        if (isValidSignature) {
          logEvent("MOBILITY_SIGNATURE_VALID", {
            signatureHeader,
            signatureMethod: signatureMeta.method,
          });
        }
      } catch (err) {
        logEvent("MOBILITY_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
        }, "error");
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        logEvent("MOBILITY_AUTH_BYPASS", {
          reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
          signatureHeader,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        }, "warn");
      } else {
        logEvent("MOBILITY_AUTH_FAILED", {
          signatureProvided: signatureMeta.provided,
          signatureHeader,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        }, "warn");
        return respond({ error: "unauthorized" }, { status: 401 });
      }
    }

    let payload: WhatsAppWebhookPayload;
    try {
      payload = rawBody ? JSON.parse(rawBody) : {} as WhatsAppWebhookPayload;
    } catch (err) {
      logEvent("MOBILITY_PAYLOAD_INVALID_JSON", {
        error: err instanceof Error ? err.message : String(err),
      }, "warn");
      return respond({ error: "invalid_payload" }, { status: 400 });
    }
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return respond({ success: true, ignored: "no_message" });
    }

    const from = message.from;
    if (!from) {
      return respond({ success: true, ignored: "no_sender" });
    }

    // 1. Build Context - Auto-create profile if needed
    const { ensureProfile } = await import("../_shared/wa-webhook-shared/utils/profile.ts");
    const profile = await ensureProfile(supabase, from);

    const ctx: RouterContext = {
      supabase,
      from,
      profileId: profile?.user_id,
      locale: (profile?.language as any) || "en",
    };

    logEvent("MOBILITY_MESSAGE_PROCESSING", { from, type: message.type, hasProfile: !!profile });

    // DIAGNOSTIC LOGGING
    console.log(JSON.stringify({
      event: "MOBILITY_DIAGNOSTIC",
      from,
      messageType: message.type,
      hasInteractive: !!message.interactive,
      interactiveType: (message.interactive as any)?.type,
      listReplyId: (message.interactive as any)?.list_reply?.id,
      buttonReplyId: (message.interactive as any)?.button_reply?.id,
      textBody: (message.text as any)?.body,
      hasProfileId: !!ctx.profileId,
      profileId: ctx.profileId,
    }));

    // 2. Get State
    const state = ctx.profileId ? await getState(supabase, ctx.profileId) : null;
    logEvent("MOBILITY_STATE", { key: state?.key });

    // 3. Dispatch
    let handled = false;

    // A. Handle Interactive Messages (Buttons/Lists)
    if (message.type === "interactive") {
      const interactive = message.interactive as any;
      const buttonId = interactive?.button_reply?.id;
      const listId = interactive?.list_reply?.id;
      const id = buttonId || listId;

      if (id) {
        logEvent("MOBILITY_INTERACTION", { id });
        
        // DIAGNOSTIC: Log what we're checking
        console.log(JSON.stringify({
          event: "MOBILITY_CHECKING_ID",
          id,
          expectedKeys: ["rides_agent", "rides", IDS.SEE_DRIVERS],
          willMatch: id === IDS.SEE_DRIVERS || id === "rides_agent" || id === "rides",
        }));

        // Nearby Flows
        if (id === IDS.SEE_DRIVERS || id === "rides_agent" || id === "rides") {
          console.log(JSON.stringify({ event: "MOBILITY_LAUNCHING_WORKFLOW", workflow: "handleSeeDrivers" }));
          handled = await handleSeeDrivers(ctx);
          console.log(JSON.stringify({ event: "MOBILITY_WORKFLOW_RESULT", workflow: "handleSeeDrivers", handled }));
        } else if (id === IDS.SEE_PASSENGERS) {
          handled = await handleSeePassengers(ctx);
        } else if (isVehicleOption(id) && state?.key === "mobility_nearby_select") {
          handled = await handleVehicleSelection(ctx, state.data as any, id);
        } else if (id.startsWith("MTCH::") && state?.key === "mobility_nearby_results") {
          handled = await handleNearbyResultSelection(ctx, state.data as any, id);
        } else if (id === IDS.MOBILITY_CHANGE_VEHICLE) {
          handled = await handleChangeVehicleRequest(ctx, state?.data as any);
        } else if (id === IDS.USE_CACHED_LOCATION && state?.key === "mobility_nearby_location") {
          handled = await handleUseCachedLocation(ctx, state.data as any);
        } else if (id === IDS.USE_CACHED_LOCATION && state?.key === "go_online_prompt") {
          handled = await handleGoOnlineUseCached(ctx);
        } else if (id === IDS.LOCATION_SAVED_LIST && state?.key === "mobility_nearby_location") {
          handled = await startNearbySavedLocationPicker(ctx, state.data as any);
        } else if (id.startsWith("FAV::") && state?.key === "location_saved_picker" && state.data?.source === "nearby") {
          handled = await handleNearbySavedLocationSelection(ctx, state.data as any, id);
        }
        
        // Go Online / Offline Flows
        else if (id === IDS.GO_ONLINE || id === "driver_go_online") {
          handled = await startGoOnline(ctx);
        } else if (id === IDS.DRIVER_GO_OFFLINE) {
          handled = await handleGoOffline(ctx);
        }
        
        // Driver Response Actions (Offer Ride, View Details)
        else if (id.startsWith(IDS.DRIVER_OFFER_RIDE + "::") || id.startsWith(IDS.DRIVER_VIEW_DETAILS + "::")) {
          handled = await routeDriverAction(ctx, id);
        }
        
        // Schedule Flows
        else if (id === IDS.SCHEDULE_TRIP) {
          handled = await startScheduleTrip(ctx, state as any);
        } else if ((id === IDS.ROLE_DRIVER || id === IDS.ROLE_PASSENGER) && state?.key === "schedule_role") {
          handled = await handleScheduleRole(ctx, id);
        } else if (isVehicleOption(id) && state?.key === "schedule_location") {
          handled = await handleScheduleVehicle(ctx, state.data as any, id);
        } else if (id === IDS.MOBILITY_CHANGE_VEHICLE && state?.key?.startsWith("schedule_")) {
          handled = await handleScheduleChangeVehicle(ctx, state.data as any);
        } else if (id === IDS.SCHEDULE_SKIP_DROPOFF && state?.key === "schedule_dropoff") {
          handled = await handleScheduleSkipDropoff(ctx, state.data as any);
        } else if (id.startsWith("time::") && state?.key === "schedule_time_select") {
          handled = await handleScheduleTimeSelection(ctx, state.data as any, id);
        } else if (id.startsWith("recur::") && state?.key === "schedule_recur") {
          handled = await handleScheduleRecurrenceSelection(ctx, state.data as any, id);
        } else if (id === IDS.SCHEDULE_REFRESH_RESULTS && state?.key === "mobility_nearby_results") { // Reusing results key? Check schedule.ts
           // Schedule refresh might need its own key or reuse nearby results structure
           // Checking schedule.ts: handleScheduleRefresh uses state.tripId
           handled = await handleScheduleRefresh(ctx, state?.data as any);
        } else if (id === IDS.LOCATION_SAVED_LIST && state?.key === "schedule_location") {
           handled = await startScheduleSavedLocationPicker(ctx, state.data as any, "pickup");
        } else if (id === IDS.LOCATION_SAVED_LIST && state?.key === "schedule_dropoff") {
           handled = await startScheduleSavedLocationPicker(ctx, state.data as any, "dropoff");
        } else if (id.startsWith("FAV::") && state?.key === "location_saved_picker" && state.data?.source === "schedule") {
           handled = await handleScheduleSavedLocationSelection(ctx, state.data as any, id);
        }
        
        // Trip Lifecycle Management
        else if (id === "TRIP_START" && state?.data?.matchId) {
          const matchId = state.data.matchId;
          handled = await handleTripStart(ctx, matchId);
        } else if (id === "TRIP_ARRIVED" && state?.data?.tripId) {
          const tripId = state.data.tripId;
          handled = await handleTripArrivedAtPickup(ctx, tripId);
        } else if (id === "TRIP_PICKED_UP" && state?.data?.tripId) {
          const tripId = state.data.tripId;
          handled = await handleTripPickedUp(ctx, tripId);
        } else if (id === "TRIP_COMPLETE" && state?.data?.tripId) {
          const tripId = state.data.tripId;
          handled = await handleTripComplete(ctx, tripId);
        } else if (id.startsWith("TRIP_CANCEL::")) {
          const tripId = id.replace("TRIP_CANCEL::", "");
          handled = await handleTripCancel(ctx, tripId, "user", ctx.profileId || "");
        } else if (id.startsWith("RATE::")) {
          const parts = id.split("::");
          const tripId = parts[1];
          const rating = parseInt(parts[2]);
          handled = await handleTripRate(ctx, tripId, rating);
        }
        
        // Real-Time Tracking
        else if (id === "UPDATE_LOCATION" && state?.data?.tripId) {
          const tripId = state.data.tripId;
          // Location will come from location message, just acknowledge
          handled = true;
        } else if (id === "VIEW_DRIVER_LOCATION" && state?.data?.tripId) {
          const tripId = state.data.tripId;
          const location = await getDriverLocation(ctx, tripId);
          if (location) {
            // Send location back to user (TODO: implement location message sending)
            handled = true;
          }
        }
      }
    }

    // B. Handle Location Messages
    else if (message.type === "location") {
      const loc = message.location as any;
      if (loc && loc.latitude && loc.longitude) {
        const coords = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
        logEvent("MOBILITY_LOCATION", coords);

        // Real-time tracking location updates
        if (state?.key === "trip_in_progress" && state?.data?.tripId && state?.data?.role === "driver") {
          const tripId = state.data.tripId;
          handled = await updateDriverLocation(ctx, tripId, coords);
        }
        // Existing location handlers
        else if (state?.key === "mobility_nearby_location") {
          handled = await handleNearbyLocation(ctx, state.data as any, coords);
        } else if (state?.key === "go_online_prompt") {
          handled = await handleGoOnlineLocation(ctx, coords);
        } else if (state?.key === "schedule_location") {
          handled = await handleScheduleLocation(ctx, state.data as any, coords);
        } else if (state?.key === "schedule_dropoff") {
          handled = await handleScheduleDropoff(ctx, state.data as any, coords);
        }
      }
    }

    // C. Handle Image/Document Messages (Insurance Certificate Upload)
    else if ((message.type === "image" || message.type === "document") && state?.key === driverInsuranceStateKey) {
      const mediaId = (message.image as any)?.id || (message.document as any)?.id;
      const mimeType = (message.image as any)?.mime_type || (message.document as any)?.mime_type || "image/jpeg";
      
      if (mediaId) {
        logEvent("MOBILITY_INSURANCE_UPLOAD", { mediaId, mimeType });
        
        const resumeData = parseInsuranceState(state.data);
        if (resumeData) {
          const result = await handleInsuranceCertificateUpload(ctx, resumeData, mediaId, mimeType);
          
          if (result.success && result.resumeData) {
            // Resume the original flow after successful upload
            if (result.resumeData.type === "go_online") {
              handled = await startGoOnline(ctx);
            } else if (result.resumeData.type === "nearby_passengers") {
              handled = await handleSeePassengers(ctx);
            } else if (result.resumeData.type === "schedule_role") {
              handled = await startScheduleTrip(ctx, state as any);
            }
          } else if (result.error) {
            // Error message already sent by handler
            handled = true;
          }
        }
      }
    }

    // D. Handle Text Messages (Keywords/Fallbacks)
    else if (message.type === "text") {
      const text = (message.text as any)?.body?.toLowerCase() ?? "";
      
      // Check for menu selection keys first
      if (text === "rides_agent" || text === "rides") {
        handled = await handleSeeDrivers(ctx);
      }
      // Simple keyword triggers if not in a specific flow or if flow allows interruption
      else if (text.includes("driver") || text.includes("ride")) {
        handled = await handleSeeDrivers(ctx);
      } else if (text.includes("passenger")) {
        handled = await handleSeePassengers(ctx);
      } else if (text.includes("schedule") || text.includes("book")) {
        handled = await startScheduleTrip(ctx, state as any);
      }
    }

    if (!handled) {
      // If we have state but didn't handle the input, maybe show a generic "I didn't understand" or just ignore
      // For now, we'll just log it.
      logEvent("MOBILITY_UNHANDLED_MESSAGE", { from, type: message.type });
    }

    return respond({ success: true, handled });

  } catch (err) {
    logEvent("MOBILITY_WEBHOOK_ERROR", {
      error: err instanceof Error ? err.message : String(err),
    }, "error");

    return respond({
      error: "internal_error",
      service: "wa-webhook-mobility",
      requestId,
    }, {
      status: 500,
    });
  }
});

console.log("✅ wa-webhook-mobility service started");
