import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export async function listMyVehicles(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Query insurance_profiles which contains vehicle_metadata
  const { data: vehicleProfiles, error } = await ctx.supabase
    .from("insurance_profiles")
    .select("id, vehicle_identifier, vehicle_metadata, created_at")
    .eq("user_id", ctx.profileId)
    .not("vehicle_identifier", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch vehicles:", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load your vehicles. Please try again.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }],
    );
    return true;
  }

  if (!vehicleProfiles || vehicleProfiles.length === 0) {
    await sendButtonsMessage(
      ctx,
      "🚗 *You don't have any registered vehicles yet.*\n\nTap below to chat with our Insurance AI Agent who will help you register your vehicle through a simple conversation.",
      [
        { id: IDS.INSURANCE_AGENT, title: "💬 Chat with Insurance Agent" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  const rows = vehicleProfiles.map((v) => {
    const metadata = v.vehicle_metadata as any;
    const make = metadata?.make || metadata?.brand || "Unknown";
    const model = metadata?.model || "";
    const year = metadata?.year || "";
    const plate = v.vehicle_identifier || "No plate";
    
    const title = `${make} ${model} ${year}`.trim() || "Vehicle";
    const description = `Plate: ${plate}`;

    return {
      id: `VEHICLE::${v.id}`,
      title,
      description,
    };
  });

  rows.push(
    {
      id: IDS.INSURANCE_AGENT,
      title: "💬 Add via AI Agent",
      description: "Chat with AI to register new vehicle",
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
      title: "🚗 My Vehicles",
      body: `You have ${vehicleProfiles.length} registered vehicle${vehicleProfiles.length === 1 ? "" : "s"}`,
      sectionTitle: "Vehicles",
      buttonText: "View",
      rows,
    },
    { emoji: "🚗" },
  );

  return true;
}

export async function handleVehicleSelection(
  ctx: RouterContext,
  vehicleId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: vehicle, error } = await ctx.supabase
    .from("insurance_profiles")
    .select("*")
    .eq("id", vehicleId)
    .eq("user_id", ctx.profileId)
    .single();

  if (error || !vehicle) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Vehicle not found or you don't have permission to view it.",
      [{ id: IDS.MY_VEHICLES, title: "← Back to Vehicles" }],
    );
    return true;
  }

  const metadata = (vehicle.vehicle_metadata as any) || {};
  const plate = vehicle.vehicle_identifier || "No plate";
  
  const details = [
    `*Vehicle Details*`,
    `Plate Number: ${plate}`,
    metadata.make ? `Make: ${metadata.make || metadata.brand}` : null,
    metadata.model ? `Model: ${metadata.model}` : null,
    metadata.year ? `Year: ${metadata.year}` : null,
    metadata.color ? `Color: ${metadata.color}` : null,
    metadata.vin ? `VIN: ${metadata.vin}` : null,
    vehicle.status ? `\nInsurance Status: ${vehicle.status}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendListMessage(
    ctx,
    {
      title: "🚗 Vehicle Details",
      body: details,
      sectionTitle: "Actions",
      buttonText: "Choose",
      rows: [
        {
          id: `VIEW_VEHICLE_INSURANCE::${vehicleId}`,
          title: "🛡️ View Insurance",
          description: "Check insurance details",
        },
        {
          id: IDS.INSURANCE_AGENT,
          title: "💬 Update via AI",
          description: "Chat with AI to update vehicle info",
        },
        {
          id: IDS.MY_VEHICLES,
          title: "← Back",
          description: "Return to vehicles list",
        },
      ],
    },
    { emoji: "🚗" },
  );

  return true;
}
