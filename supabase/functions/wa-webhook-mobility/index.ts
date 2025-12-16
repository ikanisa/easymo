// wa-webhook-mobility - Simplified version
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "../_shared/observability/index.ts";
import { getState } from "../_shared/wa-webhook-shared/state/store.ts";
import {
  handleNearbyLocation,
  handleSeeDrivers,
  handleSeePassengers,
  handleVehicleSelection,
  isVehicleOption,
} from "./handlers/nearby.ts";
import {
  handleScheduleLocation,
  handleScheduleRole,
  handleScheduleVehicle,
  startScheduleTrip,
} from "./handlers/schedule.ts";
import {
  handleGoOffline,
  handleGoOnlineLocation,
  startGoOnline,
} from "./handlers/go_online.ts";
import type { RouterContext, WhatsAppWebhookPayload } from "./types.ts";
import type { SupportedLanguage } from "./i18n/language.ts";
import { IDS } from "./wa/ids.ts";
import { supabase } from "./config.ts";
import { recordLastLocation } from "./locations/favorites.ts";
import { showMobilityMenu } from "./handlers/menu.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { maskPhone } from "../_shared/phone-utils.ts";

const STATE_KEYS = {
  NEARBY_SELECT: "mobility_nearby_select",
  NEARBY_LOCATION: "mobility_nearby_location",
  GO_ONLINE: "mobility_go_online",
  SCHEDULE_ROLE: "mobility_schedule_role",
  SCHEDULE_LOCATION: "mobility_schedule_location",
  SCHEDULE_VEHICLE: "mobility_schedule_vehicle",
} as const;

serve(async (req: Request): Promise<Response> => {
  const respond = (body: unknown, status = 200): Response => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  // Health check
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return respond({ status: "ok" });
    }
    return respond({ error: "not_found" }, 404);
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify WhatsApp signature (Security requirement)
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ??
      Deno.env.get("WA_APP_SECRET");
    const allowUnsigned =
      (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() ===
        "true";
    // Validate internal forward with token to prevent spoofing
    const { isValidInternalForward } = await import(
      "../_shared/security/internal-forward.ts"
    );
    const internalForward = isValidInternalForward(req);

    if (!appSecret) {
      logStructuredEvent("MOBILITY_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, 500);
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
          logStructuredEvent("MOBILITY_SIGNATURE_VALID", {
            signatureHeader,
            correlationId,
          });
        }
      } catch (err) {
        logStructuredEvent("MOBILITY_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
          correlationId,
        }, "error");
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        logStructuredEvent("MOBILITY_AUTH_BYPASS", {
          reason: internalForward
            ? "internal_forward"
            : signature
            ? "signature_mismatch"
            : "no_signature",
          correlationId,
        }, "warn");
      } else {
        logStructuredEvent("MOBILITY_AUTH_FAILED", {
          signatureProvided: !!signature,
          correlationId,
        }, "warn");
        return respond({ error: "unauthorized" }, 401);
      }
    }

    // Parse payload after verification
    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody);
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contacts = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!message || !message.from) {
      return respond({ success: true });
    }

    const from = message.from;
    const profileName = contacts?.profile?.name || "User";

    // Ensure user exists
    const { data: profileData, error: profileError } = await supabase.rpc(
      "ensure_whatsapp_user",
      {
        _wa_id: from,
        _profile_name: profileName,
      },
    );

    if (profileError) {
      logStructuredEvent("MOBILITY_USER_ENSURE_ERROR", {
        error: profileError.message,
        from: from.slice(-4),
        correlationId,
      }, "error");
      return respond({ error: "user_creation_failed" }, 500);
    }

    const profileId = profileData?.profile_id || "";
    const locale = (profileData?.locale || "en") as SupportedLanguage;

    const ctx: RouterContext = {
      supabase,
      from,
      profileId,
      locale,
    };

    // Get state
    const state = profileId ? await getState(supabase, profileId) : null;

    // Handle interactive messages
    if (message.type === "interactive") {
      const interactive = message.interactive as {
        button_reply?: { id?: string };
        list_reply?: { id?: string };
      };
      const id = interactive?.button_reply?.id || interactive?.list_reply?.id;

      if (!id) {
        return respond({ success: true });
      }

      // Main menu
      if (id === IDS.RIDES_MENU || id === "rides_agent" || id === "rides") {
        await showMobilityMenu(ctx);
        return respond({ success: true });
      }

      // Nearby flows
      if (id === IDS.SEE_DRIVERS) {
        await handleSeeDrivers(ctx);
        return respond({ success: true });
      }

      if (id === IDS.SEE_PASSENGERS) {
        await handleSeePassengers(ctx);
        return respond({ success: true });
      }

      if (isVehicleOption(id) && state?.key === STATE_KEYS.NEARBY_SELECT) {
        if (state.data && typeof state.data === "object") {
          await handleVehicleSelection(
            ctx,
            state.data as Record<string, unknown>,
            id,
          );
        }
        return respond({ success: true });
      }

      // Go online/offline
      if (id === IDS.GO_ONLINE || id === "driver_go_online") {
        await startGoOnline(ctx);
        return respond({ success: true });
      }

      if (id === IDS.GO_OFFLINE) {
        await handleGoOffline(ctx);
        return respond({ success: true });
      }

      // Schedule flows
      if (id === IDS.SCHEDULE_TRIP) {
        await startScheduleTrip(
          ctx,
          state || { key: "mobility_menu", data: {} },
        );
        return respond({ success: true });
      }

      if (
        (id === IDS.ROLE_DRIVER || id === IDS.ROLE_PASSENGER) &&
        state?.key === STATE_KEYS.SCHEDULE_ROLE
      ) {
        await handleScheduleRole(ctx, id);
        return respond({ success: true });
      }

      if (
        isVehicleOption(id) &&
        (state?.key === STATE_KEYS.SCHEDULE_LOCATION ||
          state?.key === STATE_KEYS.SCHEDULE_VEHICLE)
      ) {
        if (state.data && typeof state.data === "object") {
          await handleScheduleVehicle(
            ctx,
            state.data as Record<string, unknown>,
            id,
          );
        }
        return respond({ success: true });
      }
    }

    // Handle location messages
    if (message.type === "location") {
      const loc = message.location as
        | { latitude?: number; longitude?: number }
        | undefined;
      if (loc?.latitude && loc?.longitude) {
        const lat = Number(loc.latitude);
        const lng = Number(loc.longitude);

        // Validate coordinates
        if (
          isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 ||
          lng > 180
        ) {
          logStructuredEvent("MOBILITY_INVALID_LOCATION", {
            lat,
            lng,
            from: from.slice(-4),
            correlationId,
          }, "warn");
          return respond({ error: "invalid_location" }, 400);
        }

        const coords = { lat, lng };

        await recordLastLocation(ctx, coords).catch(() => {});

        if (state?.key === STATE_KEYS.NEARBY_LOCATION) {
          if (state.data && typeof state.data === "object") {
            await handleNearbyLocation(
              ctx,
              state.data as Record<string, unknown>,
              coords,
            );
          }
        } else if (state?.key === STATE_KEYS.GO_ONLINE) {
          await handleGoOnlineLocation(ctx, coords);
        } else if (state?.key === STATE_KEYS.SCHEDULE_LOCATION) {
          if (state.data && typeof state.data === "object") {
            await handleScheduleLocation(
              ctx,
              state.data as Record<string, unknown>,
              coords,
            );
          }
        }
      }
      return respond({ success: true });
    }

    // Handle text messages
    if (message.type === "text") {
      const textMessage = message.text as { body?: string } | undefined;
      const text = (textMessage?.body?.toLowerCase() || "").trim();

      // Validate text input (prevent injection attacks)
      if (text.length > 1000) {
        logStructuredEvent("MOBILITY_TEXT_TOO_LONG", {
          length: text.length,
          from: from.slice(-4),
          correlationId,
        }, "warn");
        return respond({ error: "text_too_long" }, 400);
      }

      if (text === "rides" || text === "rides_agent") {
        await showMobilityMenu(ctx);
        return respond({ success: true });
      }

      if (text.includes("driver") || text.includes("ride")) {
        await handleSeeDrivers(ctx);
        return respond({ success: true });
      }

      if (text.includes("passenger")) {
        await handleSeePassengers(ctx);
        return respond({ success: true });
      }

      if (text.includes("schedule") || text.includes("book")) {
        await startScheduleTrip(
          ctx,
          state || { key: "mobility_menu", data: {} },
        );
        return respond({ success: true });
      }
    }

    return respond({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    logStructuredEvent("MOBILITY_ERROR", {
      error: errorMessage,
      stack: errorStack,
      correlationId,
      requestId,
    }, "error");
    return respond({ error: "internal_error" }, 500);
  }
});

logStructuredEvent("SERVICE_STARTED", {
  service: "wa-webhook-mobility",
  version: "2.0.0",
});
