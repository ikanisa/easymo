import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export async function listSavedLocations(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: locations, error } = await ctx.supabase
    .from("user_favorites")
    .select("id, name, address, lat, lng, created_at")
    .eq("user_id", ctx.profileId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch saved locations:", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load your saved locations. Please try again.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }],
    );
    return true;
  }

  if (!locations || locations.length === 0) {
    await sendButtonsMessage(
      ctx,
      "📍 You don't have any saved locations yet.\n\nSave your favorite places for quick access!",
      [
        { id: IDS.ADD_LOCATION, title: "➕ Add Location" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  const rows = locations.map((loc) => ({
    id: `LOC::${loc.id}`,
    title: loc.name || "Unnamed Location",
    description: loc.address || `${loc.lat?.toFixed(6)}, ${loc.lng?.toFixed(6)}`,
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
      body: `You have ${locations.length} saved location${locations.length === 1 ? "" : "s"}`,
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
    .from("user_favorites")
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
    `*${location.name || "Unnamed Location"}*`,
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
