/**
 * Driver Insurance Handler
 * 
 * Handles driver insurance certificate upload and validation
 * Replaces the old vehicle plate text input flow
 */

import type { RouterContext } from "../types.ts";
import type { SupabaseClient } from "../deps.ts";
import { setState, clearState } from "../state/store.ts";
import { sendText } from "../wa/client.ts";
import {
  processDriverInsuranceCertificate,
  validateInsuranceData,
  checkDuplicateVehicle,
  saveInsuranceCertificate,
  type DriverInsuranceData,
} from "../insurance/driver_insurance_ocr.ts";

const INSURANCE_STATE_KEY = "driver_insurance_upload";

type ResumeState =
  | { type: "schedule_role"; roleId: string }
  | { type: "nearby_passengers" }
  | { type: "go_online" };

type InsuranceStateData = ResumeState;

/**
 * Check if user has valid insurance certificate
 */
export async function hasValidInsurance(
  client: SupabaseClient,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("is_driver_insurance_valid", {
    p_user_id: profileId,
  });

  if (error) {
    console.error("DRIVER_INS_CHECK_ERROR", error);
    return false;
  }

  return data === true;
}

/**
 * Get active insurance for user
 */
export async function getActiveInsurance(
  client: SupabaseClient,
  profileId: string,
): Promise<{
  id: string;
  vehicle_plate: string;
  insurer_name: string;
  policy_number: string;
  policy_expiry: string;
  status: string;
} | null> {
  const { data, error } = await client.rpc("get_driver_active_insurance", {
    p_user_id: profileId,
  });

  if (error) {
    console.error("DRIVER_INS_GET_ERROR", error);
    return null;
  }

  return data?.[0] || null;
}

/**
 * Ensure driver has valid insurance, prompt for upload if not
 */
export async function ensureDriverInsurance(
  ctx: RouterContext,
  resume: ResumeState,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const hasInsurance = await hasValidInsurance(ctx.supabase, ctx.profileId);
  if (hasInsurance) return true;

  const prompt =
    "📋 To become a driver on easyMO, please upload your vehicle insurance certificate.\n\n" +
    "Send a clear photo or PDF of your insurance document. We'll verify:\n" +
    "✅ Insurance is not expired\n" +
    "✅ Vehicle registration plate\n" +
    "✅ Policy details\n\n" +
    "This helps keep all drivers and passengers safe! 🛡️";

  await setState(ctx.supabase, ctx.profileId, {
    key: INSURANCE_STATE_KEY,
    data: resume,
  });

  await sendText(ctx.from, prompt);
  return false;
}

export const driverInsuranceStateKey = INSURANCE_STATE_KEY;

export function parseInsuranceState(
  data: Record<string, unknown> | undefined,
): InsuranceStateData | null {
  if (!data) return null;
  
  const type = typeof data.type === "string" ? data.type : null;
  
  if (type === "schedule_role") {
    const roleId = typeof data.roleId === "string" ? data.roleId : null;
    if (!roleId) return null;
    return { type, roleId };
  }
  
  if (type === "nearby_passengers") {
    return { type };
  }
  
  if (type === "go_online") {
    return { type };
  }
  
  return null;
}

/**
 * Fetch media from WhatsApp and get signed URL
 */
async function fetchMediaUrl(
  mediaId: string,
  waToken: string,
): Promise<{ url: string; mimeType: string }> {
  // Get media URL from WhatsApp
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v17.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${waToken}`,
      },
    }
  );

  if (!mediaResponse.ok) {
    throw new Error(`Failed to fetch media info: ${mediaResponse.status}`);
  }

  const mediaInfo = await mediaResponse.json();
  const mediaUrl = mediaInfo.url;
  const mimeType = mediaInfo.mime_type || "image/jpeg";

  // Download media
  const downloadResponse = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${waToken}`,
    },
  });

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download media: ${downloadResponse.status}`);
  }

  const blob = await downloadResponse.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  // Create data URL for OCR
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return { url: dataUrl, mimeType };
}

/**
 * Handle insurance certificate upload
 */
export async function handleInsuranceCertificateUpload(
  ctx: RouterContext,
  resume: InsuranceStateData,
  mediaId: string,
  mimeType: string,
): Promise<{ success: boolean; error?: string; resumeData?: ResumeState }> {
  if (!ctx.profileId) {
    return { success: false, error: "Missing profile" };
  }

  try {
    // Get WA token from env
    const waToken = resolveWaToken();
    if (!waToken) {
      console.error("DRIVER_INS_UPLOAD_ERROR", "WA_TOKEN not configured");
      await sendText(ctx.from, "⚠️ Unable to process insurance uploads at the moment (missing WhatsApp credentials). Please try again later.");
      return { success: false, error: "missing_token" };
    }

    // Send processing message
    await sendText(ctx.from, "⏳ Processing your insurance certificate...");

    // Fetch media
    const { url: signedUrl, mimeType: actualMimeType } = await fetchMediaUrl(mediaId, waToken);

    // Process with OCR
    const { data, provider } = await processDriverInsuranceCertificate(
      signedUrl,
      actualMimeType,
    );

    // Validate extracted data
    const validation = validateInsuranceData(data);
    if (!validation.valid) {
      const missingFields = validation.errors.join(", ");
      return {
        success: false,
        error: `⚠️ Could not read the following from your certificate: ${missingFields}\n\nPlease upload a clearer photo or PDF.`,
      };
    }

    // Check for duplicate vehicle
    const isDuplicate = await checkDuplicateVehicle(
      ctx.supabase,
      data.registration_plate,
      ctx.profileId,
    );

    if (isDuplicate) {
      return {
        success: false,
        error: `⚠️ Vehicle ${data.registration_plate} is already registered by another driver.\n\nIf this is your vehicle, please contact support.`,
      };
    }

    // Save to database
    const { id, error: saveError } = await saveInsuranceCertificate(
      ctx.supabase,
      ctx.profileId,
      data,
      signedUrl,
      mediaId,
      provider,
      data as unknown as Record<string, unknown>,
    );

    if (saveError) {
      return {
        success: false,
        error: `⚠️ Failed to save insurance certificate: ${saveError}`,
      };
    }

    // Clear state
    await clearState(ctx.supabase, ctx.profileId);

    // Send success message
    const expiryDate = new Date(data.policy_expiry).toLocaleDateString();
    await sendText(
      ctx.from,
      `✅ Insurance certificate verified!\n\n` +
      `🚗 Vehicle: ${data.registration_plate}\n` +
      `🏢 Insurer: ${data.insurer_name}\n` +
      `📅 Valid until: ${expiryDate}\n\n` +
      `You're all set to drive on easyMO! 🎉`,
    );

    return { success: true, resumeData: resume };
  } catch (error) {
    console.error("DRIVER_INS_UPLOAD_ERROR", error);
    return {
      success: false,
      error: `⚠️ Failed to process certificate: ${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again with a clearer photo.`,
    };
  }
}

/**
 * Legacy function for backward compatibility
 * Now redirects to insurance upload
 */
export async function ensureVehiclePlate(
  ctx: RouterContext,
  resume: ResumeState,
): Promise<boolean> {
  return await ensureDriverInsurance(ctx, resume);
}

/**
 * Get vehicle plate from active insurance
 */
export async function getVehiclePlate(
  client: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  const insurance = await getActiveInsurance(client, profileId);
  return insurance?.vehicle_plate || null;
}
function resolveWaToken(): string | null {
  return Deno.env.get("WA_DRIVER_TOKEN") ??
    Deno.env.get("WA_TOKEN") ??
    Deno.env.get("WHATSAPP_ACCESS_TOKEN") ??
    null;
}
