import type { RouterContext, WhatsAppLocationMessage } from "../types.ts";
import { handleNearbyLocation } from "../domains/mobility/nearby.ts";
import {
  handleScheduleDropoff,
  handleScheduleLocation,
} from "../domains/mobility/schedule.ts";
import { maybeHandleDriverLocation } from "../observe/driver_parser.ts";
import { recordInbound } from "../observe/conv_audit.ts";
import { sendText } from "../wa/client.ts";
import { clearState } from "../state/store.ts";
// AI Agents Integration
import { handleAIAgentLocationUpdate } from "../domains/ai-agents/index.ts";

import {
  handleFindPropertyLocation,
  handleAddPropertyLocation,
} from "../domains/property/rentals.ts";
import { recordLastLocation } from "../domains/locations/favorites.ts";
import {
  handleSavedPlaceLocation,
  type SavedPlaceCaptureState,
} from "../domains/locations/manage.ts";
import { saveRecentLocation } from "../domains/locations/recent.ts";
import {
  handleJobFindLocation,
  handleJobPostLocation,
  type JobFindLocationState,
  type JobPostState,
} from "../domains/jobs/index.ts";

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
  try {
    const source = state.key?.includes('bars') ? 'bars'
      : state.key?.includes('pharmacy') ? 'pharmacies'
      : state.key?.includes('quincaillerie') ? 'quincailleries'
      : state.key === 'shops_wait_location' ? 'shops'
      : state.key?.includes('notary') ? 'notary'
      : state.key?.includes('property') ? 'property'
      : state.key?.includes('mobility') ? 'mobility'
      : undefined;
    await saveRecentLocation(ctx, { lat, lng }, source as any);
  } catch (_) { /* non-fatal */ }
  
  /* AI AGENT LOCATION ROUTING - DISABLED FOR PHASE 1 (NEARBY SEARCHES)
     Only enabled for Waiter AI and Real Estate AI agents
     Phase 2: Will enable for pharmacy, quincaillerie, shops, drivers
  
  const aiAgentStates = [
    "ai_driver_waiting_locations",      // DISABLED - Phase 2
    "ai_pharmacy_waiting_location",     // DISABLED - Phase 2
    "ai_quincaillerie_waiting_location",// DISABLED - Phase 2
    "ai_shops_waiting_location",        // DISABLED - Phase 2
    "ai_property_waiting_location",     // ENABLED - Real Estate AI
  ];
  */
  
  // PHASE 1: Only Real Estate and Waiter AI use agents
  const aiAgentStates = [
    "ai_property_waiting_location",     // Real Estate AI (ENABLED)
    // Waiter AI doesn't use location routing
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
  
  if (state.key === "job_find_location") {
    const stateData = (state.data ?? {}) as JobFindLocationState;
    return await handleJobFindLocation(
      ctx,
      stateData,
      { lat, lng },
    );
  }
  
  if (state.key === "job_post_location") {
    const stateData = (state.data ?? {}) as JobPostState;
    return await handleJobPostLocation(
      ctx,
      stateData,
      { lat, lng },
    );
  }

  if (state.key === "driver_go_online") {
    const { handleDriverLocationUpdate } = await import("../domains/mobility/driver_actions.ts");
    return await handleDriverLocationUpdate(ctx, { lat, lng });
  }

  if (state.key === "mobility_nearby_location") {
    return await handleNearbyLocation(ctx, (state.data ?? {}) as any, {
      lat,
      lng,
    });
  }

  // Add New Business flow: capture coords and advance to category selection
  if (state.key === 'business_add_new' && (state.data as any)?.stage === 'location') {
    const { handleAddNewBusinessLocation } = await import('../domains/business/add_new.ts');
    return await handleAddNewBusinessLocation(ctx, (state.data as any), { lat, lng });
  }

  // Business edit: update GPS coordinates from WhatsApp location share
  if (state.key === "business_edit" && (state.data as any)?.stage === "awaiting_location") {
    const businessId = (state.data as any)?.businessId as string | undefined;
    if (!businessId) return false;
    const { error } = await ctx.supabase
      .from("business")
      .update({ latitude: lat, longitude: lng })
      .eq("id", businessId);
    if (error) {
      await sendText(ctx, "⚠️ Failed to update location. Please try again.");
      return true;
    }
    if (ctx.profileId) {
      try { await clearState(ctx.supabase, ctx.profileId); } catch (_) { /* noop */ }
    }
    await sendText(ctx, "✅ Location updated.");
    return true;
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
  return false;
}

async function sendDineInDisabledNotice(ctx: RouterContext): Promise<void> {
  await sendText(
    ctx.from,
    "Dine-in orders are handled separately. Please contact our team for assistance.",
  );
}
