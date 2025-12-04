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
      "To add a vehicle, simply send us a photo or PDF of your valid insurance certificate (Yellow Card).\n\n" +
      "We'll automatically extract the vehicle details and register it for you!",
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
      const cert = ownership.driver_insurance_certificates;
      
      if (!vehicle) return null;
      
      const make = vehicle.make || "Unknown";
      const model = vehicle.model || "";
      const year = vehicle.vehicle_year || "";
      const plate = vehicle.registration_plate || "No plate";
      
      const title = `${plate}`;
      const description = `${make} ${model} ${year}`.trim() || "Vehicle";
      
      // Check if insurance is expired
      const isExpired = cert?.policy_expiry && new Date(cert.policy_expiry) < new Date();
      const statusEmoji = isExpired ? "⚠️" : cert?.status === "approved" ? "✅" : "🕐";

      return {
        id: `VEHICLE::${vehicle.id}`,
        title: `${statusEmoji} ${title}`,
        description,
      };
    })
    .filter((row): row is { id: string; title: string; description: string } => row !== null);

  rows.push(
    {
      id: "ADD_VEHICLE",
      title: "➕ Add New Vehicle",
      description: "Upload insurance certificate",
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
      ),
      driver_insurance_certificates:insurance_certificate_id (
        id,
        policy_number,
        policy_expiry,
        insurer_name,
        status,
        media_url
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
  const cert = ownership.driver_insurance_certificates as any;
  const plate = vehicle.registration_plate || "No plate";
  
  // Check insurance expiry
  const isExpired = cert?.policy_expiry && new Date(cert.policy_expiry) < new Date();
  const daysUntilExpiry = cert?.policy_expiry 
    ? Math.ceil((new Date(cert.policy_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  
  const insuranceStatus = isExpired 
    ? "⚠️ *EXPIRED*" 
    : daysUntilExpiry && daysUntilExpiry <= 7
    ? `⚠️ Expiring in ${daysUntilExpiry} days`
    : cert?.status === "approved"
    ? "✅ Active"
    : "🕐 Pending";
  
  const details = [
    `🚗 *Vehicle Details*`,
    ``,
    `📋 *Plate:* ${plate}`,
    vehicle.make ? `🏢 *Make:* ${vehicle.make}` : null,
    vehicle.model ? `🚙 *Model:* ${vehicle.model}` : null,
    vehicle.vehicle_year ? `📅 *Year:* ${vehicle.vehicle_year}` : null,
    vehicle.color ? `🎨 *Color:* ${vehicle.color}` : null,
    vehicle.vin_chassis ? `🔢 *VIN:* ${vehicle.vin_chassis}` : null,
    ``,
    `🛡️ *Insurance*`,
    `Status: ${insuranceStatus}`,
    cert?.insurer_name ? `Company: ${cert.insurer_name}` : null,
    cert?.policy_number ? `Policy: ${cert.policy_number}` : null,
    cert?.policy_expiry ? `Expires: ${new Date(cert.policy_expiry).toLocaleDateString()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const actions = [];
  
  if (isExpired || (daysUntilExpiry && daysUntilExpiry <= 30)) {
    actions.push({
      id: `RENEW_INSURANCE::${vehicleId}`,
      title: "🔄 Renew Insurance",
      description: "Upload new insurance certificate",
    });
  }
  
  actions.push(
    {
      id: IDS.MY_VEHICLES,
      title: "← Back",
      description: "Return to vehicles list",
    },
  );

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
