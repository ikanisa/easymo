import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { parseCoordinates, formatCoordinates } from "../utils/coordinates.ts";

export async function listSavedLocations(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Show loading state
  const { sendText } = await import("../../_shared/wa-webhook-shared/wa/client.ts");
  await sendText(ctx.from, "⏳ Loading your saved locations...");

  const { data: locations, error } = await ctx.supabase
    .from("saved_locations")
    .select("id, label, address, lat, lng, created_at")
    .eq("user_id", ctx.profileId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    // P1 fix - Issue #11: Sanitize error message (don't expose to user)
    logStructuredEvent("PROFILE_LOCATIONS_FETCH_ERROR", {
      userId: ctx.profileId,
      error: error.message,
    }, "error");
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load your saved locations. Please try again.",
      [
        { id: IDS.SAVED_LOCATIONS, title: "🔄 Try Again" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  if (!locations || locations.length === 0) {
    await sendListMessage(
      ctx,
      {
        title: "📍 Saved Locations",
        body:
          "You don't have any saved locations yet.\n\n*How to save a location:*\n" +
          "1. Choose a location type below\n" +
          "2. Share your location using WhatsApp's location button (📎)\n" +
          "3. Or type an address\n\n" +
          "Save your favorite places for quick ride booking!",
        sectionTitle: "Add Location",
        buttonText: "Choose",
        rows: [
          {
            id: "ADD_LOC::home",
            title: "🏠 Home",
            description: "Save your home address",
          },
          {
            id: "ADD_LOC::work",
            title: "💼 Work",
            description: "Save your work address",
          },
          {
            id: "ADD_LOC::school",
            title: "🎓 School",
            description: "Save your school address",
          },
          {
            id: "ADD_LOC::other",
            title: "📍 Other",
            description: "Save another favorite place",
          },
          {
            id: IDS.BACK_PROFILE,
            title: "← Back",
            description: "Return to profile menu",
          },
        ],
      },
      { emoji: "📍" },
    );
    return true;
  }

  const rows = locations.map((loc) => ({
    id: `LOC::${loc.id}`,
    title: loc.label || "Unnamed Location",
    description: loc.address ||
      `${loc.lat?.toFixed(6)}, ${loc.lng?.toFixed(6)}`,
  }));

  rows.push(
    {
      id: IDS.ADD_LOCATION,
      title: "➕ Add New Location",
      description: "Save a new favorite place",
    },
    {
      id: IDS.BACK_PROFILE,
      title: "← Back to Profile",
      description: "Return to profile menu",
    },
  );

  await sendListMessage(
    ctx,
    {
      title: "📍 Saved Locations",
      body: `You have ${locations.length} saved location${
        locations.length === 1 ? "" : "s"
      }`,
      sectionTitle: "Locations",
      buttonText: "View",
      rows,
    },
    { emoji: "📍" },
  );

  return true;
}

export async function handleLocationSelection(
  ctx: RouterContext,
  locationId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: location, error } = await ctx.supabase
    .from("saved_locations")
    .select("*")
    .eq("id", locationId)
    .eq("user_id", ctx.profileId)
    .single();

  if (error || !location) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Location not found or you don't have permission to view it.",
      [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
    );
    return true;
  }

  const details = [
    `*${location.label || "Unnamed Location"}*`,
    location.address ? `📍 ${location.address}` : null,
    location.lat && location.lng
      ? `Coordinates: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendListMessage(
    ctx,
    {
      title: "📍 Location Details",
      body: details,
      sectionTitle: "Actions",
      buttonText: "Choose",
      rows: [
        {
          id: `USE_LOC::${locationId}`,
          title: "🎯 Use Location",
          description: "Use this location for a ride or delivery",
        },
        {
          id: `EDIT_LOC::${locationId}`,
          title: "✏️ Edit",
          description: "Update location details",
        },
        {
          id: `DELETE_LOC::${locationId}`,
          title: "🗑️ Delete",
          description: "Remove this saved location",
        },
        {
          id: IDS.SAVED_LOCATIONS,
          title: "← Back",
          description: "Return to locations list",
        },
      ],
    },
    { emoji: "📍" },
  );

  return true;
}

/**
 * Show location type selection menu for adding a new location
 */
export async function showAddLocationTypeMenu(ctx: RouterContext): Promise<boolean> {
  await sendListMessage(
    ctx,
    {
      title: "📍 Add Saved Location",
      body: "Choose the type of location you want to save:",
      sectionTitle: "Location Type",
      buttonText: "Choose",
      rows: [
        {
          id: "ADD_LOC::home",
          title: "🏠 Home",
          description: "Save your home address",
        },
        {
          id: "ADD_LOC::work",
          title: "💼 Work",
          description: "Save your work address",
        },
        {
          id: "ADD_LOC::school",
          title: "🎓 School",
          description: "Save your school address",
        },
        {
          id: "ADD_LOC::other",
          title: "📍 Other",
          description: "Save another favorite place",
        },
        {
          id: IDS.SAVED_LOCATIONS,
          title: "← Cancel",
          description: "Back to saved locations",
        },
      ],
    },
    { emoji: "➕" },
  );
  return true;
}

/**
 * Prompt user to share location for a specific type
 */
export async function promptAddLocation(
  ctx: RouterContext,
  locationType: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "add_location",
    data: { type: locationType },
  });
  
  await sendButtonsMessage(
    ctx,
    `📍 *Add ${
      locationType.charAt(0).toUpperCase() + locationType.slice(1)
    } Location*\n\nPlease share your location or send the address.`,
    [
      { id: IDS.SAVED_LOCATIONS, title: "← Cancel" },
    ],
  );
  return true;
}

/**
 * Confirm and save a new location
 */
export async function confirmSaveLocation(
  ctx: RouterContext,
  locationType: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId || !state || state.key !== "confirm_add_location" || !state.data) {
    return false;
  }

  const { lat, lng, address } = state.data as {
    lat: number;
    lng: number;
    address?: string;
  };

  // Show loading state
  await sendText(ctx.from, "⏳ Saving location...");

  const { error } = await ctx.supabase
    .from("saved_locations")
    .insert({
      user_id: ctx.profileId,
      label: locationType,
      lat,
      lng,
      address: address || null,
    });

  // Also save to location cache (30-min TTL) for use by other services
  if (!error) {
    try {
      await ctx.supabase.rpc("update_user_location_cache", {
        _user_id: ctx.profileId,
        _lat: lat,
        _lng: lng,
      });
      logStructuredEvent("PROFILE_LOCATION_CACHED", {
        user: ctx.profileId,
        type: locationType,
        lat,
        lng,
      });
    } catch (cacheError) {
      // Log but don't fail - saved location is more important
      logStructuredEvent("PROFILE_CACHE_FAILED", {
        error: cacheError instanceof Error
          ? cacheError.message
          : String(cacheError),
      }, "warn");
    }
  }

  await clearState(ctx.supabase, ctx.profileId);

  if (error) {
    await sendButtonsMessage(
      ctx,
      `⚠️ Failed to save location. Please try again.`,
      [
        { id: IDS.SAVED_LOCATIONS, title: "📍 Try Again" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    logStructuredEvent("PROFILE_LOCATION_SAVE_ERROR", {
      error: error.message,
      type: locationType,
    }, "error");
  } else {
    // P2-005: Add metrics for critical operations
    await recordMetric("profile.location.saved", 1, {
      type: locationType,
      profileId: ctx.profileId,
    });
    
    await sendButtonsMessage(
      ctx,
      `✅ Your ${locationType} location has been saved!\n\nYou can now use it for rides and deliveries.`,
      [
        { id: IDS.SAVED_LOCATIONS, title: "📍 View Locations" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
  }
  return true;
}

/**
 * Handle using a saved location
 */
export async function handleUseLocation(
  ctx: RouterContext,
  locationId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: location } = await ctx.supabase
    .from("saved_locations")
    .select("*")
    .eq("id", locationId)
    .eq("user_id", ctx.profileId)
    .maybeSingle();

  if (!location) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Location not found or no longer available.",
      [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
    );
    return true;
  }

  await sendButtonsMessage(
    ctx,
    `📍 *Using: ${location.label}*\n\n` +
      `${
        location.address ||
        `Coordinates: ${formatCoordinates(location.lat, location.lng)}`
      }\n\n` +
      `What would you like to do with this location?`,
    [
      { id: "RIDE_FROM_HERE", title: "🚖 Get a ride" },
      { id: "SCHEDULE_FROM_HERE", title: "📅 Schedule trip" },
      { id: IDS.SAVED_LOCATIONS, title: "← Back" },
    ],
  );
  return true;
}

/**
 * Handle editing a saved location
 */
export async function handleEditLocation(
  ctx: RouterContext,
  locationId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: location } = await ctx.supabase
    .from("saved_locations")
    .select("*")
    .eq("id", locationId)
    .eq("user_id", ctx.profileId)
    .maybeSingle();

  if (!location) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Location not found or no longer available.",
      [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: "edit_location",
    data: { locationId, originalLabel: location.label },
  });
  
  await sendButtonsMessage(
    ctx,
    `📍 *Edit: ${location.label}*\n\n` +
      `Current: ${
        location.address ||
        formatCoordinates(location.lat, location.lng)
      }\n\n` +
      `Share a new location to update this saved location.`,
    [
      { id: `LOC::${locationId}`, title: "← Cancel" },
    ],
  );
  return true;
}

/**
 * Handle deleting a saved location (confirmation prompt)
 */
export async function handleDeleteLocationPrompt(
  ctx: RouterContext,
  locationId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: location } = await ctx.supabase
    .from("saved_locations")
    .select("label")
    .eq("id", locationId)
    .eq("user_id", ctx.profileId)
    .maybeSingle();

  if (!location) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Location not found or no longer available.",
      [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: "delete_location_confirm",
    data: { locationId, label: location.label },
  });
  
  await sendButtonsMessage(
    ctx,
    `🗑️ *Delete Location?*\n\n` +
      `Are you sure you want to delete "${location.label}"?\n\n` +
      `This action cannot be undone.`,
    [
      {
        id: `CONFIRM_DELETE_LOC::${locationId}`,
        title: "✅ Yes, delete",
      },
      { id: `LOC::${locationId}`, title: "❌ Cancel" },
    ],
  );
  return true;
}

/**
 * Confirm and delete a saved location
 */
export async function confirmDeleteLocation(
  ctx: RouterContext,
  locationId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("saved_locations")
    .delete()
    .eq("id", locationId)
    .eq("user_id", ctx.profileId);

  if (error) {
    await sendButtonsMessage(
      ctx,
      `⚠️ Failed to delete location. Please try again.`,
      [{ id: IDS.SAVED_LOCATIONS, title: "← Back to Locations" }],
    );
    logStructuredEvent("LOCATION_DELETE_FAILED", {
      locationId,
      error: error.message,
    }, "error");
  } else {
    // P2-005: Add metrics for critical operations
    await recordMetric("profile.location.deleted", 1, {
      locationId,
      profileId: ctx.profileId,
    });
    
    await clearState(ctx.supabase, ctx.profileId);
    await sendButtonsMessage(
      ctx,
      "✅ Location deleted successfully!",
      [{ id: IDS.SAVED_LOCATIONS, title: "📍 View Locations" }],
    );
    logStructuredEvent("LOCATION_DELETED", { locationId });
  }
  return true;
}

/**
 * Handle location message (when user shares location via WhatsApp)
 */
export async function handleLocationMessage(
  ctx: RouterContext,
  location: { latitude?: unknown; longitude?: unknown; address?: string },
  state: { key: string; data?: Record<string, unknown> } | null,
): Promise<boolean> {
  if (!ctx.profileId || !state) return false;

  const coords = parseCoordinates(location?.latitude, location?.longitude);

  // Validate coordinates
  if (!coords) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Invalid location coordinates. Please try again.",
      [
        { id: IDS.SAVED_LOCATIONS, title: "📍 Saved Locations" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    logStructuredEvent("INVALID_COORDINATES", {
      rawLat: location?.latitude,
      rawLng: location?.longitude,
    }, "warn");
    return true;
  }

  if (state.key === IDS.ADD_LOCATION && state.data?.type) {
    // Show confirmation for new location
    const locationType = state.data.type as string;
    const address = location?.address || formatCoordinates(coords.lat, coords.lng);

    await setState(ctx.supabase, ctx.profileId, {
      key: "confirm_add_location",
      data: {
        type: locationType,
        lat: coords.lat,
        lng: coords.lng,
        address: location?.address || null,
      },
    });

    await sendButtonsMessage(
      ctx,
      `📍 *Confirm ${
        locationType.charAt(0).toUpperCase() + locationType.slice(1)
      } Location*\n\n` +
        `Address: ${address}\n` +
        `Coordinates: ${formatCoordinates(coords.lat, coords.lng)}\n\n` +
        `Is this correct?`,
      [
        {
          id: `CONFIRM_SAVE_LOC::${locationType}`,
          title: "✅ Yes, save it",
        },
        { id: IDS.SAVED_LOCATIONS, title: "❌ Cancel" },
      ],
    );
    return true;
  } else if (state.key === "edit_location" && state.data?.locationId) {
    // Update existing location
    const locationId = state.data.locationId as string;
    const { error } = await ctx.supabase
      .from("saved_locations")
      .update({
        lat: coords.lat,
        lng: coords.lng,
        address: location?.address || null,
      })
      .eq("id", locationId)
      .eq("user_id", ctx.profileId);

    // Also update location cache
    if (!error) {
      try {
        await ctx.supabase.rpc("update_user_location_cache", {
          _user_id: ctx.profileId,
          _lat: coords.lat,
          _lng: coords.lng,
        });
        logStructuredEvent("PROFILE_LOCATION_UPDATED_CACHED", {
          user: ctx.profileId,
          locationId,
          lat: coords.lat,
          lng: coords.lng,
        });
      } catch (cacheError) {
        logStructuredEvent("PROFILE_CACHE_FAILED", {
          error: cacheError instanceof Error
            ? cacheError.message
            : String(cacheError),
        }, "warn");
      }
    }

    await clearState(ctx.supabase, ctx.profileId);

    if (error) {
      await sendButtonsMessage(
        ctx,
        `⚠️ Failed to update location. Please try again.`,
        [
          { id: `LOC::${locationId}`, title: "← Back" },
          { id: IDS.SAVED_LOCATIONS, title: "📍 Locations" },
        ],
      );
      logStructuredEvent("PROFILE_LOCATION_UPDATE_ERROR", {
        error: error.message,
        locationId,
      }, "error");
    } else {
      await sendButtonsMessage(
        ctx,
        `✅ Location updated successfully!`,
        [
          { id: `LOC::${locationId}`, title: "📍 View Location" },
          { id: IDS.SAVED_LOCATIONS, title: "📍 All Locations" },
        ],
      );
    }
    return true;
  }

  return false;
}

/**
 * Handle text address input for location (geocoding not yet implemented)
 */
export async function handleLocationTextAddress(
  ctx: RouterContext,
  address: string,
  state: { key: string; data?: Record<string, unknown> } | null,
): Promise<boolean> {
  if (!ctx.profileId || !state?.data?.type) return false;

  const locationType = state.data.type as string;

  // For now, just confirm receipt - actual location saving would need geocoding
  await clearState(ctx.supabase, ctx.profileId);

  await sendButtonsMessage(
    ctx,
    `✅ Thank you! We've received your ${locationType} address:\n\n${address}\n\nTo save it with coordinates, please share your location using WhatsApp's location feature.`,
    [
      { id: IDS.SAVED_LOCATIONS, title: "📍 Locations" },
      { id: IDS.BACK_PROFILE, title: "← Back" },
    ],
  );
  return true;
}
