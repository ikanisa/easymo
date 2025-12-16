import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import {
  clearState,
  setState,
} from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

/**
 * Start the vehicle addition flow - Step 1: Select vehicle type
 */
export async function startAddVehicle(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) {
    await sendText(
      ctx.from,
      "⚠️ Please create your profile first before adding a vehicle.",
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: "vehicle_add_select_type",
    data: {},
  });

  await sendListMessage(
    ctx,
    {
      title: "🚗 Add Vehicle",
      body: "First, select your vehicle type:",
      sectionTitle: "Vehicle Types",
      rows: [
        {
          id: "veh_moto",
          title: "🏍️ Moto taxi",
          description: "Two-wheel motorcycle",
        },
        {
          id: "veh_cab",
          title: "🚗 Cab",
          description: "Standard car (4 wheels)",
        },
        {
          id: "veh_lifan",
          title: "🛺 Lifan",
          description: "Three-wheel cargo vehicle",
        },
        {
          id: "veh_truck",
          title: "🚚 Truck",
          description: "Pickup or delivery truck",
        },
        {
          id: "veh_other",
          title: "🚐 Other",
          description: "Bus, van, or other vehicle",
        },
      ],
      buttonText: "Select",
    },
  );

  logStructuredEvent("VEHICLE_ADD_STARTED", { userId: ctx.profileId });
  return true;
}

/**
 * Handle vehicle type selection - Step 2: Request number plate
 */
export async function handleVehicleTypeSelection(
  ctx: RouterContext,
  vehicleType: string,
): Promise<boolean> {
  if (!ctx.profileId) {
    await sendText(ctx.from, "⚠️ Please create your profile first.");
    return true;
  }

  // Map vehicle type IDs to display names
  const vehicleNames: Record<string, string> = {
    veh_moto: "Moto taxi",
    veh_cab: "Cab",
    veh_lifan: "Lifan",
    veh_truck: "Truck",
    veh_other: "Other vehicle",
  };

  const vehicleName = vehicleNames[vehicleType] || vehicleType;

  await setState(ctx.supabase, ctx.profileId, {
    key: "vehicle_add_plate",
    data: { vehicleType },
  });

  await sendButtonsMessage(
    ctx,
    `🚗 *Add ${vehicleName}*\n\n` +
      "Please type your vehicle's number plate.\n\n" +
      "📋 *Examples:*\n" +
      "• RAB 123 B (car)\n" +
      "• RA 123 B (moto)\n" +
      "• RAC 456 A (truck)\n\n" +
      "Type the plate number below:",
    [
      { id: IDS.MY_VEHICLES, title: "← Cancel" },
    ],
  );

  logStructuredEvent("VEHICLE_TYPE_SELECTED", {
    userId: ctx.profileId,
    vehicleType,
  });

  return true;
}

/**
 * Validate Rwandan vehicle plate number format
 * Formats: RAB 123 B, RA 123 B, RAC 456 A, etc.
 */
function isValidPlateNumber(plate: string): boolean {
  // Normalize: remove extra spaces, convert to uppercase
  const normalized = plate.toUpperCase().replace(/\s+/g, " ").trim();

  // Rwanda plate patterns:
  // Cars: RAB 123 A (3 letters + 3 digits + 1 letter)
  // Motos: RA 123 B (2 letters + 3 digits + 1 letter)
  // Trucks: RAC 123 A, etc.
  const carPattern = /^R[A-Z]{2}\s?\d{3}\s?[A-Z]$/;
  const motoPattern = /^R[A-Z]\s?\d{3}\s?[A-Z]$/;

  return carPattern.test(normalized) || motoPattern.test(normalized);
}

/**
 * Normalize plate number to standard format
 */
function normalizePlateNumber(plate: string): string {
  return plate.toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Handle plate number text input - Step 3: Create vehicle
 */
export async function handleVehiclePlateInput(
  ctx: RouterContext,
  plateText: string,
  state: { key: string; data?: { vehicleType?: string } },
): Promise<boolean> {
  if (!ctx.profileId) {
    await sendText(ctx.from, "⚠️ Please create your profile first.");
    return true;
  }

  // Get vehicle type from state
  const vehicleType = state?.data?.vehicleType || "veh_other";
  const plateNumber = normalizePlateNumber(plateText);

  // Validate plate number format
  if (!isValidPlateNumber(plateNumber)) {
    await sendButtonsMessage(
      ctx,
      "⚠️ *Invalid plate number format*\n\n" +
        `You entered: ${plateText}\n\n` +
        "Please enter a valid Rwandan plate number:\n" +
        "• RAB 123 B (car)\n" +
        "• RA 123 B (moto)\n" +
        "• RAC 456 A (truck)\n\n" +
        "Type the correct plate number:",
      [
        { id: IDS.MY_VEHICLES, title: "← Cancel" },
      ],
    );
    return true;
  }

  try {
    // Check if plate already exists in vehicles table
    const { data: existingVehicle } = await ctx.supabase
      .from("vehicles")
      .select("id, registration_plate")
      .eq("registration_plate", plateNumber)
      .maybeSingle();

    if (existingVehicle) {
      // Check if vehicle is owned by someone else
      const { data: vehicleOwner } = await ctx.supabase
        .from("vehicle_ownerships")
        .select("user_id")
        .eq("vehicle_id", existingVehicle.id)
        .eq("is_current", true)
        .neq("user_id", ctx.profileId)
        .maybeSingle();

      if (vehicleOwner) {
        await clearState(ctx.supabase, ctx.profileId);
        await sendButtonsMessage(
          ctx,
          "⚠️ *Vehicle Already Registered*\n\n" +
            `The vehicle with plate *${plateNumber}* is already registered to another user.\n\n` +
            "If you believe this is an error, please contact support.",
          [
            { id: "ADD_VEHICLE", title: "🔄 Try Different Plate" },
            { id: IDS.MY_VEHICLES, title: "← Back" },
          ],
        );
        return true;
      }

      // Check if user already owns this vehicle
      const { data: userOwnsVehicle } = await ctx.supabase
        .from("vehicle_ownerships")
        .select("id")
        .eq("vehicle_id", existingVehicle.id)
        .eq("user_id", ctx.profileId)
        .eq("is_current", true)
        .maybeSingle();

      if (userOwnsVehicle) {
        await clearState(ctx.supabase, ctx.profileId);
        await sendButtonsMessage(
          ctx,
          "ℹ️ *Vehicle Already Added*\n\n" +
            `The vehicle with plate *${plateNumber}* is already in your vehicles list.`,
          [
            { id: IDS.MY_VEHICLES, title: "📋 View My Vehicles" },
            { id: IDS.BACK_PROFILE, title: "← Back to Profile" },
          ],
        );
        return true;
      }
    }

    // Upsert vehicle in database
    const { data: vehicleId, error: vehicleError } = await ctx.supabase
      .rpc("upsert_vehicle", {
        p_plate: plateNumber,
        p_make: null,
        p_model: null,
        p_year: null,
        p_vin: null,
        p_vehicle_type: vehicleType,
      });

    if (vehicleError || !vehicleId) {
      throw new Error(
        vehicleError?.message || "Failed to create vehicle record",
      );
    }

    // Create vehicle ownership (without insurance certificate)
    const { error: ownershipError } = await ctx.supabase.rpc(
      "create_vehicle_ownership",
      {
        p_vehicle_id: vehicleId,
        p_user_id: ctx.profileId,
        p_certificate_id: null,
      },
    );

    if (ownershipError) {
      logStructuredEvent("VEHICLE_OWNERSHIP_ERROR", {
        userId: ctx.profileId,
        vehicleId,
        plate: plateNumber,
        error: ownershipError.message,
      }, "error");
      throw new Error("Failed to associate vehicle with your account");
    }

    // Clear state
    await clearState(ctx.supabase, ctx.profileId);

    // Map vehicle type IDs to display names
    const vehicleNames: Record<string, string> = {
      veh_moto: "Moto taxi",
      veh_cab: "Cab",
      veh_lifan: "Lifan",
      veh_truck: "Truck",
      veh_other: "Other vehicle",
    };

    const vehicleName = vehicleNames[vehicleType] || vehicleType;

    // Send success message
    await sendButtonsMessage(
      ctx,
      `✅ *Vehicle Added Successfully!*\n\n` +
        `🚗 *Plate Number:* ${plateNumber}\n` +
        `🚙 *Type:* ${vehicleName}\n\n` +
        `Your vehicle is now registered and ready to use for rides!`,
      [
        { id: IDS.MY_VEHICLES, title: "📋 View My Vehicles" },
        { id: IDS.BACK_PROFILE, title: "← Back to Profile" },
      ],
    );

    logStructuredEvent("VEHICLE_ADDED_SUCCESS", {
      userId: ctx.profileId,
      vehicleId,
      plate: plateNumber,
      vehicleType,
    });

    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    logStructuredEvent("VEHICLE_ADD_ERROR", {
      userId: ctx.profileId,
      plate: plateNumber,
      error: errorMsg,
    }, "error");

    await clearState(ctx.supabase, ctx.profileId);

    await sendButtonsMessage(
      ctx,
      `❌ *Failed to add vehicle*\n\n` +
        `Error: ${errorMsg}\n\n` +
        `Please try again or contact support if the issue persists.`,
      [
        { id: "ADD_VEHICLE", title: "🔄 Try Again" },
        { id: IDS.MY_VEHICLES, title: "← Back" },
      ],
    );

    return true;
  }
}
