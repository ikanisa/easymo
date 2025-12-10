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

  // Query vehicles through vehicle_ownerships
  const { data: ownerships, error } = await ctx.supabase
    .from("vehicle_ownerships")
    .select(`
      id,
      vehicle_id,
      created_at,
      vehicles:vehicle_id (
        id,
        registration_plate,
        make,
        model,
        vehicle_year,
        vehicle_type,
        status
      ),
      driver_insurance_certificates:insurance_certificate_id (
        policy_expiry,
        insurer_name,
        status
      )
    `)
    .eq("user_id", ctx.profileId)
    .eq("is_current", true)
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

  if (!ownerships || ownerships.length === 0) {
    await sendButtonsMessage(
      ctx,
      "🚗 *You don't have any registered vehicles yet.*\n\n" +
      "Tap the button below to add your vehicle by entering the plate number.",
      [
        { id: "ADD_VEHICLE", title: "➕ Add Vehicle" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  const rows = ownerships
    .map((ownership: any) => {
      const vehicle = ownership.vehicles;
      
      if (!vehicle) return null;
      
      const make = vehicle.make || "";
      const model = vehicle.model || "";
      const year = vehicle.vehicle_year || "";
      const plate = vehicle.registration_plate || "No plate";
      const vehicleType = vehicle.vehicle_type || "";
      
      const title = `${plate}`;
      const typeLabels: Record<string, string> = {
        veh_moto: "Moto",
        veh_cab: "Cab",
        veh_lifan: "Lifan",
        veh_truck: "Truck",
        veh_other: "Vehicle",
      };
      const typeLabel = typeLabels[vehicleType] || "Vehicle";
      const description = make && model 
        ? `${make} ${model} ${year}`.trim() 
        : typeLabel;

      return {
        id: `VEHICLE::${vehicle.id}`,
        title: `🚗 ${title}`,
        description,
      };
    })
    .filter((row): row is { id: string; title: string; description: string } => row !== null);

  rows.push(
    {
      id: "ADD_VEHICLE",
      title: "➕ Add New Vehicle",
      description: "Enter plate number",
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
      body: `You have ${ownerships.length} registered vehicle${ownerships.length === 1 ? "" : "s"}`,
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

  const { data: ownership, error } = await ctx.supabase
    .from("vehicle_ownerships")
    .select(`
      id,
      vehicle_id,
      created_at,
      vehicles:vehicle_id (
        id,
        registration_plate,
        make,
        model,
        vehicle_year,
        vin_chassis,
        color,
        vehicle_type,
        status
      )
    `)
    .eq("user_id", ctx.profileId)
    .eq("vehicle_id", vehicleId)
    .eq("is_current", true)
    .maybeSingle();

  if (error || !ownership) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Vehicle not found or you don't have permission to view it.",
      [{ id: IDS.MY_VEHICLES, title: "← Back to Vehicles" }],
    );
    return true;
  }

  const vehicle = ownership.vehicles as any;
  const plate = vehicle.registration_plate || "No plate";
  
  // Map vehicle type IDs to display names
  const vehicleNames: Record<string, string> = {
    veh_moto: "Moto taxi",
    veh_cab: "Cab",
    veh_lifan: "Lifan",
    veh_truck: "Truck",
    veh_other: "Other vehicle",
  };
  const vehicleTypeName = vehicleNames[vehicle.vehicle_type] || "Vehicle";
  
  const details = [
    `🚗 *Vehicle Details*`,
    ``,
    `📋 *Plate:* ${plate}`,
    `🚙 *Type:* ${vehicleTypeName}`,
    vehicle.make ? `🏢 *Make:* ${vehicle.make}` : null,
    vehicle.model ? `📦 *Model:* ${vehicle.model}` : null,
    vehicle.vehicle_year ? `📅 *Year:* ${vehicle.vehicle_year}` : null,
    vehicle.color ? `🎨 *Color:* ${vehicle.color}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const actions = [
    {
      id: IDS.MY_VEHICLES,
      title: "← Back",
      description: "Return to vehicles list",
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: "🚗 Vehicle Details",
      body: details,
      sectionTitle: "Actions",
      buttonText: "Choose",
      rows: actions,
    },
    { emoji: "🚗" },
  );

  return true;
}
