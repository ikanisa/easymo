import type { RouterContext, WhatsAppLocationMessage } from "../types.ts";
import { handleNearbyLocation } from "../domains/mobility/nearby.ts";
import {
  handleScheduleDropoff,
  handleScheduleLocation,
} from "../domains/mobility/schedule.ts";
import { handleMarketplaceLocation } from "../domains/marketplace/index.ts";
import { maybeHandleDriverLocation } from "../observe/driver_parser.ts";
import { recordInbound } from "../observe/conv_audit.ts";
// AI Agents Integration
import { handleAIAgentLocationUpdate } from "../domains/ai-agents/index.ts";
import { handlePharmacyLocation } from "../domains/healthcare/pharmacies.ts";
import { handleQuincaillerieLocation } from "../domains/healthcare/quincailleries.ts";
import { handleNotaryLocation } from "../domains/services/notary.ts";
import {
  handleFindPropertyLocation,
  handleAddPropertyLocation,
} from "../domains/property/rentals.ts";
import { recordLastLocation } from "../domains/locations/favorites.ts";
import {
  handleSavedPlaceLocation,
  type SavedPlaceCaptureState,
} from "../domains/locations/manage.ts";

export async function handleLocation(
  ctx: RouterContext,
  msg: WhatsAppLocationMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  // Record inbound for correlation (best-effort)
  try {
    await recordInbound(ctx, msg);
  } catch (_) { /* noop */ }
  // Best-effort driver location collection (non-blocking)
  try {
    await maybeHandleDriverLocation(ctx, msg);
  } catch (_) { /* noop */ }
  const rawLat = msg.location?.latitude;
  const rawLng = msg.location?.longitude;
  const lat = typeof rawLat === "number"
    ? rawLat
    : typeof rawLat === "string"
    ? parseFloat(rawLat)
    : Number.NaN;
  const lng = typeof rawLng === "number"
    ? rawLng
    : typeof rawLng === "string"
    ? parseFloat(rawLng)
    : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  await recordLastLocation(ctx, { lat, lng });
  
  // Check if this is for an AI agent
  const aiAgentStates = [
    "ai_driver_waiting_locations",
    "ai_pharmacy_waiting_location",
    "ai_quincaillerie_waiting_location",
    "ai_shops_waiting_location",
    "ai_property_waiting_location",
  ];
  
  if (aiAgentStates.includes(state.key)) {
    return await handleAIAgentLocationUpdate(ctx, state, { latitude: lat, longitude: lng });
  }

  if (state.key === "saved_place_capture") {
    return await handleSavedPlaceLocation(
      ctx,
      (state.data ?? {}) as SavedPlaceCaptureState,
      { lat, lng },
    );
  }
  
  if (state.key === "pharmacy_awaiting_location") {
    return await handlePharmacyLocation(ctx, { lat, lng });
  }
  
  if (state.key === "quincaillerie_awaiting_location") {
    return await handleQuincaillerieLocation(ctx, { lat, lng });
  }
  
  if (state.key === "bars_wait_location") {
    const { handleBarsLocation } = await import("../domains/bars/search.ts");
    return await handleBarsLocation(ctx, { lat, lng });
  }
  
  if (state.key === "notary_awaiting_location") {
    return await handleNotaryLocation(ctx, { lat, lng });
  }
  
  if (state.key === "property_find_location") {
    const stateData = state.data as {
      rentalType: string;
      bedrooms: string;
      budget: string;
      currency?: string;
    };
    return await handleFindPropertyLocation(ctx, stateData, { lat, lng });
  }
  
  if (state.key === "property_add_location") {
    const stateData = state.data as {
      rentalType: string;
      bedrooms: string;
      price: string;
      currency?: string;
    };
    return await handleAddPropertyLocation(ctx, stateData, { lat, lng });
  }
  
  if (state.key === "mobility_nearby_location") {
    return await handleNearbyLocation(ctx, (state.data ?? {}) as any, {
      lat,
      lng,
    });
  }
  if (state.key === "schedule_location") {
    return await handleScheduleLocation(ctx, (state.data ?? {}) as any, {
      lat,
      lng,
    });
  }
  if (state.key === "schedule_dropoff") {
    return await handleScheduleDropoff(ctx, (state.data ?? {}) as any, {
      lat,
      lng,
    });
  }
  if (state.key?.startsWith("dine")) {
    await sendDineInDisabledNotice(ctx);
    return true;
  }
  if (await handleMarketplaceLocation(ctx, state, { lat, lng })) {
    return true;
  }
  return false;
}

async function sendDineInDisabledNotice(ctx: RouterContext): Promise<void> {
  await sendText(
    ctx.from,
    "Dine-in workflows are handled outside WhatsApp. Please coordinate with your success manager.",
  );
}
