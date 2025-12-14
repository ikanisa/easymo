// wa-webhook-mobility - Standalone version
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "./deps.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { clearState, getState, setState } from "./state/store.ts";
import {
  handleChangeVehicleRequest,
  handleNearbyLocation,
  handleNearbyResultSelection,
  handleNearbySavedLocationSelection,
  handleRecentSearchSelection,
  handleSeeDrivers,
  handleSeePassengers,
  handleUseCachedLocation,
  handleVehicleSelection,
  isVehicleOption,
  startNearbySavedLocationPicker,
} from "./handlers/nearby.ts";
import {
  handleScheduleChangeVehicle,
  handleScheduleDropoff,
  handleScheduleLocation,
  handleScheduleRecurrenceSelection,
  handleScheduleRefresh,
  handleScheduleResultSelection,
  handleScheduleRole,
  handleScheduleSavedLocationSelection,
  handleScheduleSkipDropoff,
  handleScheduleTimeSelection,
  handleScheduleVehicle,
  startScheduleSavedLocationPicker,
  startScheduleTrip,
} from "./handlers/schedule.ts";
import {
  handleGoOffline,
  handleGoOnlineLocation,
  handleGoOnlineUseCached,
  startGoOnline,
} from "./handlers/go_online.ts";
import { routeDriverAction } from "./handlers/driver_response.ts";
import {
  handleVehiclePlateInput,
  parsePlateState,
  vehiclePlateStateKey,
} from "./handlers/vehicle_plate.ts";
// Payment handlers

// Verification handlers
import {
  handleLicenseUpload,
  showVerificationMenu,
  startLicenseVerification,
  VERIFICATION_STATES,
} from "./handlers/driver_verification.ts";
import type {
  RawWhatsAppMessage,
  RouterContext,
  WhatsAppWebhookPayload,
} from "./types.ts";
import { IDS } from "./wa/ids.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { sendButtonsMessage, sendListMessage } from "./utils/reply.ts";
import { recordLastLocation } from "./locations/favorites.ts";
import { sendLocation, sendText } from "./wa/client.ts";
import { t } from "./i18n/translator.ts";

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

const STATE_KEYS = {
  MOBILITY: {
    NEARBY_SELECT: "mobility_nearby_select",
    NEARBY_LOCATION: "mobility_nearby_location",
    NEARBY_RESULTS: "mobility_nearby_results",
    GO_ONLINE: "mobility_go_online",
    LOCATION_SAVED_PICKER: "mobility_location_saved_picker",
    SCHEDULE_ROLE: "mobility_schedule_role",
    SCHEDULE_VEHICLE: "mobility_schedule_vehicle",
    SCHEDULE_LOCATION: "mobility_schedule_location",
    SCHEDULE_DROPOFF: "mobility_schedule_dropoff",
    SCHEDULE_TIME: "mobility_schedule_time",
    SCHEDULE_RECURRENCE: "mobility_schedule_recurrence",
    SCHEDULE_RESULTS: "mobility_schedule_results",
  },
} as const;

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
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "wa-webhook-mobility");
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
      correlationId,
      path: url.pathname,
      ...details,
    }, level);
  };

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return respond({
      status: "healthy",
      service: "wa-webhook-mobility",
      timestamp: new Date().toISOString(),
    });
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

    // Protect against large payloads
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB
    if (rawBody.length > MAX_BODY_SIZE) {
      logEvent("MOBILITY_PAYLOAD_TOO_LARGE", { size: rawBody.length }, "warn");
      return respond({ error: "payload_too_large" }, { status: 413 });
    }

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
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ??
      Deno.env.get("WA_APP_SECRET");
    const runtimeEnv =
      (Deno.env.get("APP_ENV") ?? Deno.env.get("NODE_ENV") ?? "development")
        .toLowerCase();
    const allowUnsigned = runtimeEnv !== "production" &&
      runtimeEnv !== "prod" &&
      (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() ===
        "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";
    const allowInternalForward =
      (Deno.env.get("WA_ALLOW_INTERNAL_FORWARD") ?? "false").toLowerCase() ===
        "true";

    if (!appSecret) {
      logEvent(
        "MOBILITY_AUTH_CONFIG_ERROR",
        { reason: "missing_app_secret" },
        "error",
      );
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(
          rawBody,
          signature,
          appSecret,
        );
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
      const bypass = allowUnsigned || (internalForward && allowInternalForward);
      if (bypass) {
        logEvent("MOBILITY_AUTH_BYPASS", {
          reason: internalForward
            ? "internal_forward"
            : signature
            ? "signature_mismatch"
            : "no_signature",
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
    const { ensureProfile } = await import(
      "../_shared/wa-webhook-shared/utils/profile.ts"
    );
    const profile = await ensureProfile(supabase, from);

    const ctx: RouterContext = {
      supabase,
      from,
      profileId: profile?.user_id,
      locale: (profile?.language as any) || "en",
    };

    // 2. Get State
    const state = ctx.profileId
      ? await getState(supabase, ctx.profileId)
      : null;

    // 3. Dispatch
    let handled = false;

    // A. Handle Interactive Messages (Buttons/Lists)
    if (message.type === "interactive") {
      const interactive = message.interactive as any;
      const buttonId = interactive?.button_reply?.id;
      const listId = interactive?.list_reply?.id;
      const id = buttonId || listId;

      if (id) {

        // Mobility main menu
        if (id === IDS.RIDES_MENU || id === "rides_agent" || id === "rides") {
          handled = await showMobilityMenu(ctx);
        } else if (id === IDS.BACK_MENU || id === IDS.BACK_HOME) {
          handled = await showMobilityMenu(ctx);
        } // Nearby Flows
        else if (id === IDS.SEE_DRIVERS) {
          handled = await handleSeeDrivers(ctx);
        } else if (id === IDS.SEE_PASSENGERS) {
          handled = await handleSeePassengers(ctx);
        } else if (
          isVehicleOption(id) &&
          state?.key === STATE_KEYS.MOBILITY.NEARBY_SELECT
        ) {
          handled = await handleVehicleSelection(ctx, state.data as any, id);
        } else if (
          id.startsWith("MTCH::") &&
          state?.key === STATE_KEYS.MOBILITY.NEARBY_RESULTS
        ) {
          handled = await handleNearbyResultSelection(
            ctx,
            state.data as any,
            id,
          );
        } else if (id === IDS.MOBILITY_CHANGE_VEHICLE) {
          handled = await handleChangeVehicleRequest(ctx, state?.data as any);
        } else if (
          id === IDS.USE_CACHED_LOCATION &&
          state?.key === STATE_KEYS.MOBILITY.NEARBY_LOCATION
        ) {
          handled = await handleUseCachedLocation(ctx, state.data as any);
        } else if (
          id === IDS.USE_LAST_LOCATION &&
          state?.key === STATE_KEYS.MOBILITY.NEARBY_LOCATION
        ) {
          // Handle "Use Last Location" - reuse recent location
          if (!ctx.profileId) {
            handled = false;
          } else {
            const { handleUseLastLocation } = await import(
              "../../_shared/wa-webhook-shared/locations/request-location.ts"
            );
            const { getLocationReusedMessage } = await import(
              "../../_shared/wa-webhook-shared/locations/messages.ts"
            );

            const lastLoc = await handleUseLastLocation(
              {
                supabase: ctx.supabase,
                userId: ctx.profileId,
                from: ctx.from,
                locale: ctx.locale,
              },
              "mobility",
            );

            if (lastLoc?.lat && lastLoc?.lng) {
              // Show confirmation message
              await sendText(
                ctx.from,
                getLocationReusedMessage(lastLoc.ageMinutes, ctx.locale),
              );

              // Continue with matching flow
              handled = await handleNearbyLocation(ctx, state.data as any, {
                lat: lastLoc.lat,
                lng: lastLoc.lng,
              });
            } else {
              // No previous location found
              await sendText(
                ctx.from,
                t(ctx.locale, "location.no_recent_found", {
                  defaultValue:
                    "No previous location found. Please share your location.",
                }),
              );
              handled = true;
            }
          }
        } else if (
          id === IDS.USE_CACHED_LOCATION &&
          state?.key === STATE_KEYS.MOBILITY.GO_ONLINE
        ) {
          handled = await handleGoOnlineUseCached(ctx);
        } else if (
          id === IDS.LOCATION_SAVED_LIST &&
          state?.key === STATE_KEYS.MOBILITY.NEARBY_LOCATION
        ) {
          handled = await startNearbySavedLocationPicker(
            ctx,
            state.data as any,
          );
        } else if (
          id.startsWith("FAV::") &&
          state?.key === STATE_KEYS.MOBILITY.LOCATION_SAVED_PICKER &&
          state.data?.source === "nearby"
        ) {
          handled = await handleNearbySavedLocationSelection(
            ctx,
            state.data as any,
            id,
          );
        } else if (
          id.startsWith("RECENT_SEARCH::") &&
          state?.key === STATE_KEYS.MOBILITY.NEARBY_SELECT
        ) {
          // Handle recent search selection (removed SHARE_NEW_LOCATION option)
          handled = await handleRecentSearchSelection(ctx, id);
        } else if (
          id === "USE_CURRENT_LOCATION" &&
          state?.key === STATE_KEYS.MOBILITY.LOCATION_SAVED_PICKER &&
          state.data?.source === "nearby"
        ) {
          handled = await handleNearbySavedLocationSelection(
            ctx,
            state.data as any,
            id,
          );
        } else if (
          id === "USE_CURRENT_LOCATION" &&
          state?.key === STATE_KEYS.MOBILITY.LOCATION_SAVED_PICKER &&
          state.data?.source === "schedule"
        ) {
          handled = await handleScheduleSavedLocationSelection(
            ctx,
            state.data as any,
            id,
          );
        } // Go Online / Offline Flows
        else if (id === IDS.GO_ONLINE || id === "driver_go_online") {
          handled = await startGoOnline(ctx);
        } else if (id === IDS.DRIVER_GO_OFFLINE) {
          handled = await handleGoOffline(ctx);
        } // Driver Response Actions (Offer Ride, View Details)
        else if (
          id.startsWith(IDS.DRIVER_OFFER_RIDE + "::") ||
          id.startsWith(IDS.DRIVER_VIEW_DETAILS + "::")
        ) {
          handled = await routeDriverAction(ctx, id);
        } // Share easyMO
        else if (id === IDS.SHARE_EASYMO) {
          if (ctx.profileId) {
            const { data: link } = await ctx.supabase
              .from("referral_links")
              .select("code")
              .eq("user_id", ctx.profileId)
              .eq("active", true)
              .single();

            const referralCode = link?.code || ctx.profileId.slice(0, 8);
            const shareUrl =
              `https://wa.me/250788346193?text=Join%20me%20on%20easyMO!%20Use%20code%20${referralCode}`;

            await sendText(
              ctx.from,
              `🔗 *Share easyMO with friends!*\n\nYour referral link:\n${shareUrl}\n\nShare this link and earn tokens when friends join! 🎉`,
            );
            handled = true;
          }
        } // Schedule Flows
        else if (id === IDS.SCHEDULE_TRIP) {
          handled = await startScheduleTrip(ctx, state as any);
        } else if (
          (id === IDS.ROLE_DRIVER || id === IDS.ROLE_PASSENGER) &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_ROLE
        ) {
          handled = await handleScheduleRole(ctx, id);
        } else if (
          isVehicleOption(id) &&
          (state?.key === STATE_KEYS.MOBILITY.SCHEDULE_LOCATION ||
            state?.key === STATE_KEYS.MOBILITY.SCHEDULE_VEHICLE)
        ) {
          handled = await handleScheduleVehicle(ctx, state.data as any, id);
        } else if (
          id === IDS.MOBILITY_CHANGE_VEHICLE &&
          state?.key?.includes("schedule_")
        ) {
          handled = await handleScheduleChangeVehicle(ctx, state.data as any);
        } else if (
          id === IDS.SCHEDULE_SKIP_DROPOFF &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_DROPOFF
        ) {
          handled = await handleScheduleSkipDropoff(ctx, state.data as any);
        } else if (
          id.startsWith("time::") &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_TIME
        ) {
          handled = await handleScheduleTimeSelection(
            ctx,
            state.data as any,
            id,
          );
        } else if (
          id.startsWith("recur::") &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_RECURRENCE
        ) {
          handled = await handleScheduleRecurrenceSelection(
            ctx,
            state.data as any,
            id,
          );
        } else if (
          id.startsWith("MTCH::") &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_RESULTS
        ) {
          handled = await handleScheduleResultSelection(
            ctx,
            state.data as any,
            id,
          );
        } else if (
          id === IDS.SCHEDULE_REFRESH_RESULTS &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_RESULTS
        ) {
          handled = await handleScheduleRefresh(ctx, state.data as any);
        } else if (
          id === IDS.USE_LAST_LOCATION &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_LOCATION
        ) {
          // Handle "Use Last Location" for schedule pickup
          if (!ctx.profileId) {
            handled = false;
          } else {
            const { handleUseLastLocation } = await import(
              "../../_shared/wa-webhook-shared/locations/request-location.ts"
            );
            const { getLocationReusedMessage } = await import(
              "../../_shared/wa-webhook-shared/locations/messages.ts"
            );

            const lastLoc = await handleUseLastLocation(
              {
                supabase: ctx.supabase,
                userId: ctx.profileId,
                from: ctx.from,
                locale: ctx.locale,
              },
              "mobility",
            );

            if (lastLoc?.lat && lastLoc?.lng) {
              // Show confirmation message
              await sendText(
                ctx.from,
                getLocationReusedMessage(lastLoc.ageMinutes, ctx.locale),
              );

              // Continue with schedule flow
              handled = await handleScheduleLocation(ctx, state.data as any, {
                lat: lastLoc.lat,
                lng: lastLoc.lng,
              });
            } else {
              await sendText(
                ctx.from,
                t(ctx.locale, "location.no_recent_found", {
                  defaultValue:
                    "No previous location found. Please share your location.",
                }),
              );
              handled = true;
            }
          }
        } else if (
          id === IDS.LOCATION_SAVED_LIST &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_LOCATION
        ) {
          handled = await startScheduleSavedLocationPicker(
            ctx,
            state.data as any,
            "pickup",
          );
        } else if (
          id === IDS.LOCATION_SAVED_LIST &&
          state?.key === STATE_KEYS.MOBILITY.SCHEDULE_DROPOFF
        ) {
          handled = await startScheduleSavedLocationPicker(
            ctx,
            state.data as any,
            "dropoff",
          );
        } else if (
          id.startsWith("FAV::") &&
          state?.key === STATE_KEYS.MOBILITY.LOCATION_SAVED_PICKER &&
          state.data?.source === "schedule"
        ) {
          handled = await handleScheduleSavedLocationSelection(
            ctx,
            state.data as any,
            id,
          );

          // Driver Verification Handlers
        } else if (id === IDS.VERIFY_LICENSE) {
          handled = await startLicenseVerification(ctx);
        } else if (id === IDS.VERIFY_STATUS) {
          handled = await showVerificationMenu(ctx);
        }
      }
    } // B. Handle Location Messages
    else if (message.type === "location") {
      const loc = message.location as any;
      if (loc && loc.latitude && loc.longitude) {
        const coords = {
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        };
        // Location logged at debug level for privacy
        await recordLastLocation(ctx, coords).catch((e) => {
          logStructuredEvent("WARNING", {
            data: "mobility.record_location_fail",
            e,
          });
        });

        // Existing location handlers
        if (state?.key === STATE_KEYS.MOBILITY.NEARBY_LOCATION) {
          handled = await handleNearbyLocation(ctx, state.data as any, coords);
        } else if (state?.key === STATE_KEYS.MOBILITY.GO_ONLINE) {
          handled = await handleGoOnlineLocation(ctx, coords);
        } else if (state?.key === STATE_KEYS.MOBILITY.SCHEDULE_LOCATION) {
          handled = await handleScheduleLocation(
            ctx,
            state.data as any,
            coords,
          );
        } else if (state?.key === STATE_KEYS.MOBILITY.SCHEDULE_DROPOFF) {
          handled = await handleScheduleDropoff(ctx, state.data as any, coords);
        }
      }
    } // C. Handle Image/Document Messages (License Upload only - insurance removed)
    else if ((message.type === "image" || message.type === "document")) {
      const mediaId = (message.image as any)?.id ||
        (message.document as any)?.id;
      const mimeType = (message.image as any)?.mime_type ||
        (message.document as any)?.mime_type || "image/jpeg";

      if (mediaId && state?.key === VERIFICATION_STATES.LICENSE_UPLOAD) {
        logEvent("MOBILITY_LICENSE_UPLOAD", { mediaId, mimeType });
        handled = await handleLicenseUpload(ctx, mediaId, mimeType);
      }
    } // D. Handle Text Messages (Keywords/Fallbacks)
    else if (message.type === "text") {
      const text = (message.text as any)?.body?.toLowerCase() ?? "";
      const rawText = (message.text as any)?.body ?? "";

      // Vehicle plate registration input
      if (state?.key === vehiclePlateStateKey) {
        const resumeData = parsePlateState(state.data);
        if (resumeData) {
          const error = await handleVehiclePlateInput(ctx, resumeData, rawText);
          if (error) {
            // Validation failed, show error
            await sendButtonsMessage(
              ctx,
              `⚠️ ${error}\n\nPlease try again:`,
              [{ id: IDS.BACK_MENU, title: "← Cancel" }],
            );
            handled = true;
          } else {
            // Success! Clear state and resume flow
            await clearState(ctx.supabase, ctx.profileId!);
            await sendText(
              ctx.from,
              `✅ Vehicle registered! Plate: ${rawText.toUpperCase()}`,
            );

            // Resume the original flow
            if (resumeData.type === "go_online") {
              handled = await startGoOnline(ctx);
            } else if (resumeData.type === "nearby_passengers") {
              handled = await handleSeePassengers(ctx);
            } else if (resumeData.type === "schedule_role") {
              handled = await startScheduleTrip(ctx, state as any);
            } else {
              handled = true;
            }
          }
        }
      } // Check for menu selection keys first
      else if (text === "rides_agent" || text === "rides") {
        handled = await showMobilityMenu(ctx);
      } // Simple keyword triggers if not in a specific flow or if flow allows interruption
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
      error: formatUnknownError(err),
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

logStructuredEvent("SERVICE_STARTED", {
  service: "wa-webhook-mobility",
  version: "1.1.0",
});

async function showMobilityMenu(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(supabase, ctx.profileId, { key: "mobility_menu", data: {} });
  const rows = [
    {
      id: IDS.SEE_DRIVERS,
      title: "🚖 Nearby drivers",
      description: "Request riders close to your location.",
    },
    {
      id: IDS.SEE_PASSENGERS,
      title: "🧍 Nearby passengers",
      description: "Drivers find people needing a ride.",
    },
    {
      id: IDS.SCHEDULE_TRIP,
      title: "🗓️ Schedule trip",
      description: "Plan a future pickup with reminders.",
    },
    {
      id: IDS.GO_ONLINE,
      title: "🟢 Go online",
      description: "Share your location to receive ride offers.",
    },
  ];
  await sendListMessage(
    ctx,
    {
      title: "🚗 Mobility",
      body: "Choose what you need help with.",
      sectionTitle: "Options",
      rows,
      buttonText: "Open",
    },
    { emoji: "🚗" },
  );
  return true;
}
