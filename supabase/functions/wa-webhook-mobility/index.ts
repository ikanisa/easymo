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

  // Health check
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return respond({ status: "ok" });
    }
    return respond({ error: "not_found" }, 404);
  }

  try {
    // Parse payload
    const payload: WhatsAppWebhookPayload = await req.json();
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contacts = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!message || !message.from) {
      return respond({ success: true });
    }

    const from = message.from;
    const profileName = contacts?.profile?.name || "User";

    // Ensure user exists
    const { data: profileData } = await supabase.rpc("ensure_whatsapp_user", {
      _wa_id: from,
      _profile_name: profileName,
    });

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
      const interactive = message.interactive as any;
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
        await handleVehicleSelection(ctx, state.data as any, id);
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
        await startScheduleTrip(ctx, state as any);
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
        await handleScheduleVehicle(ctx, state.data as any, id);
        return respond({ success: true });
      }
    }

    // Handle location messages
    if (message.type === "location") {
      const loc = message.location as any;
      if (loc?.latitude && loc?.longitude) {
        const coords = {
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        };

        await recordLastLocation(ctx, coords).catch(() => {});

        if (state?.key === STATE_KEYS.NEARBY_LOCATION) {
          await handleNearbyLocation(ctx, state.data as any, coords);
        } else if (state?.key === STATE_KEYS.GO_ONLINE) {
          await handleGoOnlineLocation(ctx, coords);
        } else if (state?.key === STATE_KEYS.SCHEDULE_LOCATION) {
          await handleScheduleLocation(ctx, state.data as any, coords);
        }
      }
      return respond({ success: true });
    }

    // Handle text messages
    if (message.type === "text") {
      const text = (message.text as any)?.body?.toLowerCase() || "";

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
        await startScheduleTrip(ctx, state as any);
        return respond({ success: true });
      }
    }

    return respond({ success: true });
  } catch (err) {
    logStructuredEvent("MOBILITY_ERROR", {
      error: err instanceof Error ? err.message : String(err),
    }, "error");
    return respond({ error: "internal_error" }, 500);
  }
});

logStructuredEvent("SERVICE_STARTED", {
  service: "wa-webhook-mobility",
  version: "2.0.0",
});
