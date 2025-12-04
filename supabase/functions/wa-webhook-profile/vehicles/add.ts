import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import type { RawWhatsAppMessage } from "../../_shared/wa-webhook-shared/types.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { fetchInsuranceMedia, uploadInsuranceBytes } from "../../_shared/wa-webhook-shared/domains/insurance/ins_media.ts";

const INSURANCE_MEDIA_BUCKET = Deno.env.get("INSURANCE_MEDIA_BUCKET") ?? "insurance-docs";

/**
 * Start the vehicle addition flow
 */
export async function startAddVehicle(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) {
    await sendText(ctx.from, "⚠️ Please create your profile first before adding a vehicle.");
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: "vehicle_add_insurance",
    data: {},
  });

  await sendButtonsMessage(
    ctx,
    "🚗 *Add Vehicle*\n\n" +
    "To add your vehicle, please send a photo or PDF of your valid insurance certificate (Yellow Card).\n\n" +
    "📋 The system will automatically extract:\n" +
    "• Vehicle registration plate\n" +
    "• Insurance policy number\n" +
    "• Insurance company name\n" +
    "• Policy expiry date\n\n" +
    "⚠️ *Important:* Your insurance must be valid (not expired).",
    [
      { id: IDS.MY_VEHICLES, title: "← Cancel" },
    ],
  );

  logStructuredEvent("VEHICLE_ADD_STARTED", { userId: ctx.profileId });
  return true;
}

/**
 * Handle insurance document upload for vehicle addition
 */
export async function handleVehicleInsuranceUpload(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
): Promise<boolean> {
  if (!ctx.profileId) {
    await sendText(ctx.from, "⚠️ Please create your profile first.");
    return true;
  }

  // Extract media ID from message
  const mediaId = message.type === "image"
    ? (message as any).image?.id
    : message.type === "document"
    ? (message as any).document?.id
    : null;

  if (!mediaId) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Please send a valid image or PDF of your insurance certificate.",
      [
        { id: IDS.MY_VEHICLES, title: "← Back" },
      ],
    );
    return true;
  }

  // Show processing message
  await sendText(ctx.from, "⏳ Processing your insurance certificate...\n\nThis may take a few seconds.");

  try {
    // Create insurance lead
    const { data: lead, error: leadError } = await ctx.supabase
      .from("insurance_leads")
      .insert({
        user_id: ctx.profileId,
        whatsapp: ctx.from,
        status: "received",
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      throw new Error("Failed to create insurance record");
    }

    const leadId = lead.id;

    // Fetch media from WhatsApp
    const media = await fetchInsuranceMedia(mediaId, leadId);

    // Upload to storage
    const { path, signedUrl } = await uploadInsuranceBytes(ctx.supabase, leadId, media);

    // Store media record
    await ctx.supabase
      .from("insurance_media")
      .insert({
        lead_id: leadId,
        wa_media_id: mediaId,
        storage_path: path,
        mime_type: media.mime,
      });

    // Call insurance OCR function
    const { data: ocrResult, error: ocrError } = await ctx.supabase.functions.invoke(
      "insurance-ocr",
      {
        body: {
          inline: { signedUrl, mime: media.mime },
        },
      },
    );

    if (ocrError || !ocrResult) {
      logStructuredEvent("VEHICLE_OCR_FAILED", { 
        userId: ctx.profileId, 
        leadId,
        error: ocrError?.message 
      }, "error");
      
      // Queue for manual review
      await ctx.supabase
        .from("insurance_media_queue")
        .insert({
          profile_id: ctx.profileId,
          wa_id: ctx.from,
          storage_path: path,
          mime_type: media.mime,
          status: "queued",
          lead_id: leadId,
        });

      await clearState(ctx.supabase, ctx.profileId);
      await sendButtonsMessage(
        ctx,
        "⚠️ *Unable to read the document automatically.*\n\n" +
        "Your document has been queued for manual review. Our team will process it shortly and notify you.\n\n" +
        "Please ensure:\n" +
        "• The image is clear and well-lit\n" +
        "• All text is readable\n" +
        "• The document is a valid insurance certificate",
        [
          { id: IDS.MY_VEHICLES, title: "📋 My Vehicles" },
          { id: IDS.BACK_PROFILE, title: "← Back" },
        ],
      );
      return true;
    }

    // Extract OCR data
    const extracted = ocrResult.normalized || ocrResult.raw;
    
    // Validate required fields
    const plateNumber = extracted?.vehicle_plate || extracted?.plate_number;
    const policyExpiry = extracted?.policy_expiry || extracted?.expires_on;
    const insurerName = extracted?.insurer_name || extracted?.insurer;
    const policyNumber = extracted?.policy_number || extracted?.policy_no;

    if (!plateNumber) {
      await clearState(ctx.supabase, ctx.profileId);
      await sendButtonsMessage(
        ctx,
        "⚠️ *Could not find vehicle plate number.*\n\n" +
        "Please make sure the document clearly shows the vehicle registration plate and try again.",
        [
          { id: "ADD_VEHICLE", title: "🔄 Try Again" },
          { id: IDS.MY_VEHICLES, title: "← Back" },
        ],
      );
      return true;
    }

    // Check if insurance is expired
    const isExpired = policyExpiry ? new Date(policyExpiry) < new Date() : false;

    if (isExpired) {
      await clearState(ctx.supabase, ctx.profileId);
      await sendButtonsMessage(
        ctx,
        `⚠️ *Insurance certificate is expired!*\n\n` +
        `Plate: ${plateNumber}\n` +
        `Expiry Date: ${policyExpiry}\n\n` +
        `Please upload a valid (non-expired) insurance certificate to add your vehicle.`,
        [
          { id: "ADD_VEHICLE", title: "🔄 Upload Valid Certificate" },
          { id: IDS.MY_VEHICLES, title: "← Back" },
        ],
      );
      return true;
    }

    // Upsert vehicle in database
    const { data: vehicleId, error: vehicleError } = await ctx.supabase
      .rpc("upsert_vehicle", {
        p_plate: plateNumber,
        p_make: extracted?.make || null,
        p_model: extracted?.model || null,
        p_year: extracted?.vehicle_year || extracted?.year || null,
        p_vin: extracted?.vin_chassis || extracted?.vin || null,
        p_vehicle_type: extracted?.vehicle_type || null,
      });

    if (vehicleError || !vehicleId) {
      throw new Error("Failed to create vehicle record");
    }

    // Create insurance certificate record
    const { data: certificate, error: certError } = await ctx.supabase
      .from("driver_insurance_certificates")
      .insert({
        user_id: ctx.profileId,
        vehicle_id: vehicleId,
        vehicle_plate: plateNumber,
        insurer_name: insurerName || "Unknown",
        policy_number: policyNumber || null,
        policy_expiry: policyExpiry || null,
        status: "approved",
        media_url: signedUrl,
      })
      .select("id")
      .single();

    if (certError) {
      logStructuredEvent("VEHICLE_CERT_INSERT_FAILED", { 
        userId: ctx.profileId, 
        vehicleId,
        error: certError.message 
      }, "warn");
    }

    // Create vehicle ownership
    await ctx.supabase.rpc("create_vehicle_ownership", {
      p_vehicle_id: vehicleId,
      p_user_id: ctx.profileId,
      p_certificate_id: certificate?.id || null,
    });

    // Update insurance lead status
    await ctx.supabase
      .from("insurance_leads")
      .update({
        raw_ocr: ocrResult.raw,
        extracted,
        status: "approved",
        file_path: path,
      })
      .eq("id", leadId);

    // Clear state
    await clearState(ctx.supabase, ctx.profileId);

    // Send success message
    const expiryText = policyExpiry 
      ? `\n📅 Insurance Expires: ${new Date(policyExpiry).toLocaleDateString()}`
      : "";

    await sendButtonsMessage(
      ctx,
      `✅ *Vehicle Added Successfully!*\n\n` +
      `🚗 *Plate Number:* ${plateNumber}\n` +
      `🏢 *Insurance Company:* ${insurerName || "Unknown"}\n` +
      `${policyNumber ? `📄 *Policy Number:* ${policyNumber}\n` : ""}` +
      `${expiryText}\n\n` +
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
      leadId,
    });

    return true;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    logStructuredEvent("VEHICLE_ADD_ERROR", {
      userId: ctx.profileId,
      error: errorMsg,
    }, "error");

    await clearState(ctx.supabase, ctx.profileId);

    await sendButtonsMessage(
      ctx,
      `❌ *Failed to process insurance certificate*\n\n` +
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
